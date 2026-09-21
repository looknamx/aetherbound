// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { GameShell, overlayPriority } from "../client/hud/GameShell";
import { Overlay } from "../client/hud/Overlay";
import { TeamStatistics } from "../client/hud/TeamStatistics";
import { simulate } from "../shared/combat";
import { combatSummary } from "../shared/roundInsights";
import { player, unit } from "./helpers";
import { scoutingView } from "../server/views";
import type { Snapshot } from "../shared/types";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(() => root!.unmount());
  root = undefined;
  document.body.replaceChildren();
});
function fixture() {
  const own = player("secret-player-id", [
      unit("cinder", "secret-unit-id", 18),
    ]),
    other = player("enemy", [unit("brook", "enemy-unit-id", 18)]);
  own.name = "Captain";
  other.name = "Opponent";
  const state: Snapshot = {
    version: 2,
    you: own.id,
    serverTime: 1000,
    devTools: false,
    room: {
      key: "ROOM",
      hostId: own.id,
      phase: "Preparing",
      round: 1,
      deadline: 2000,
      players: [own, other],
      battles: [],
      createdAt: 0,
      updatedAt: 0,
      revision: 1,
    },
    scouting: [scoutingView(own, 0), scoutingView(other, 1)],
  };
  return state;
}
function setup(state = fixture(), onAction = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const props: ComponentProps<typeof GameShell> = {
    state,
    locale: "en",
    connected: true,
    pending: false,
    remaining: 20,
    board: <div data-testid="board">Board</div>,
    bench: (
      <div>
        {state.room.players[0].units
          .filter((u) => u.slot >= 36)
          .map((u) => u.defId)
          .join(",")}
      </div>
    ),
    shop: (
      <button onClick={() => onAction({ type: "buy", index: 0 })}>
        Buy recruit
      </button>
    ),
    items: <button data-item="0">Equip</button>,
    context: <p>Context</p>,
    settings: <button>Sound</button>,
    guide: <p>Guide content</p>,
    clearDetail: vi.fn(),
    onAction,
    onHome: vi.fn(),
    onAgain: vi.fn(),
  };
  const render = async () => act(() => root!.render(<GameShell {...props} />));
  return { host, props, render, onAction };
}
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.getAttribute("aria-label") === label || b.textContent === label,
  )!;
const click = async (label: string) => act(() => button(label).click());
it("renders persistent HUD, bench, controls and no in-flow shop", async () => {
  const t = setup();
  await t.render();
  for (const cls of [
    "top-hud",
    "hud-middle",
    "board-viewport",
    "bench-bar",
    "game-action-bar",
  ])
    expect(t.host.querySelector("." + cls)).not.toBeNull();
  expect(t.host.textContent).toContain("50");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(t.host.textContent).not.toContain("Buy recruit");
});
it("shop open/close does not reroll; buying uses the existing handler and refreshed bench", async () => {
  const t = setup();
  await t.render();
  await click("Shop");
  expect(document.querySelector(".hud-overlay--bottom")).not.toBeNull();
  await click("ปิด / Close");
  expect(t.onAction).not.toHaveBeenCalled();
  await click("Shop");
  await click("Buy recruit");
  expect(t.onAction).toHaveBeenCalledExactlyOnceWith({ type: "buy", index: 0 });
  t.props.state.room.players[0].units.push(unit("brook", "b", 36));
  t.props.bench = <div>brook</div>;
  await t.render();
  expect(t.host.querySelector(".bench-bar")?.textContent).toContain("brook");
});
it.each(["item", "augment"] as const)(
  "%s choices use server options, trap dismissal and dispatch only once",
  async (kind) => {
    const t = setup();
    t.props.state.room.phase = "Choosing";
    t.props.state.room.players[0].pendingChoices = {
      [kind]: {
        round: 1,
        options:
          kind === "item"
            ? ["sunshard", "heartglass", "moonwell"]
            : ["tempo", "spring", "bastion"],
      },
    };
    await t.render();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelectorAll(".choice-grid button")).toHaveLength(3);
    await act(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button("Shop").disabled).toBe(true);
    const option = dialog.querySelector<HTMLButtonElement>(
      ".choice-grid button",
    )!;
    await act(() => {
      option.click();
      option.click();
    });
    expect(t.onAction).toHaveBeenCalledTimes(1);
    expect(t.onAction).toHaveBeenCalledWith({
      type: "choose",
      kind,
      round: 1,
      index: 0,
    });
  },
);
it("reconnect restores same choices after higher priority connection overlay", async () => {
  const t = setup();
  t.props.state.room.phase = "Choosing";
  t.props.state.room.players[0].pendingChoices = {
    item: { round: 1, options: ["sunshard", "heartglass", "moonwell"] },
  };
  await t.render();
  const text = document.querySelector(".choice-grid")!.textContent;
  t.props.connected = false;
  await t.render();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Reconnecting",
  );
  t.props.connected = true;
  await t.render();
  expect(document.querySelector(".choice-grid")!.textContent).toBe(text);
});
it("server choice removal advances item to augment without opening queued shop", async () => {
  const t = setup();
  await t.render();
  await click("Shop");
  t.props.state.room.phase = "Choosing";
  t.props.state.room.players[0].pendingChoices = {
    item: { round: 1, options: ["sunshard", "heartglass", "moonwell"] },
    augment: { round: 1, options: ["tempo", "spring", "bastion"] },
  };
  await t.render();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Choose one item",
  );
  delete t.props.state.room.players[0].pendingChoices.item;
  await t.render();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Choose a team bonus",
  );
  expect(document.body.textContent).not.toContain("Buy recruit");
});
it("round tabs select income and events without appending content to the HUD", async () => {
  const t = setup();
  t.props.state.room.players[0].latestIncome = {
    round: 1,
    before: 5,
    after: 11,
    total: 6,
    base: 5,
    interest: 0,
    win: 1,
    loss: 0,
    winStreak: 0,
    loseStreak: 0,
    augment: 0,
    other: 0,
    capped: 0,
  };
  await t.render();
  await click("Round summary");
  await click("Income");
  expect(document.querySelector('[role="tabpanel"]')?.textContent).toContain(
    "5 → 11",
  );
  await click("Events");
  expect(document.querySelector('[role="tabpanel"]')?.textContent).toContain(
    "No data yet",
  );
  expect(t.host.textContent).not.toContain("5 → 11");
});
it("scouting replaces central board, returns to own board and resets on battle", async () => {
  const t = setup();
  await t.render();
  await act(() =>
    t.host
      .querySelector<HTMLButtonElement>(".hud-player:not(:disabled)")!
      .click(),
  );
  expect(t.host.querySelector('[data-testid="board"]')).toBeNull();
  expect(t.host.querySelectorAll(".board-viewport")).toHaveLength(1);
  expect(t.host.querySelectorAll(".hud-scout [role=gridcell]")).toHaveLength(
    36,
  );
  await click("Own board");
  expect(t.host.querySelector('[data-testid="board"]')).not.toBeNull();
  await act(() =>
    t.host
      .querySelector<HTMLButtonElement>(".hud-player:not(:disabled)")!
      .click(),
  );
  t.props.state.room.phase = "Battling";
  await t.render();
  expect(t.host.querySelector(".hud-scout")).toBeNull();
  expect(button("Shop").disabled).toBe(true);
});
it("restores focus to the invoking button and locks only modal scroll", async () => {
  const t = setup();
  await t.render();
  button("Shop").focus();
  await click("Shop");
  expect(document.body.style.overflow).toBe("hidden");
  await act(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(document.activeElement).toBe(button("Shop"));
  expect(document.body.style.overflow).toBe("");
});
it("focus wraps both directions and dialog has a name", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root!.render(
      <Overlay title="Test overlay" onClose={() => {}}>
        <button>First</button>
        <button>Last</button>
      </Overlay>,
    ),
  );
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(
    document.getElementById(dialog.getAttribute("aria-labelledby")!)
      ?.textContent,
  ).toBe("Test overlay");
  button("Last").focus();
  await act(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(document.activeElement).toBe(button("ปิด / Close"));
  await act(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(document.activeElement).toBe(button("Last"));
});
it("resize preserves open choice and player UI does not print private IDs", async () => {
  const t = setup();
  t.props.locale = "th";
  t.props.state.room.phase = "Choosing";
  t.props.state.room.players[0].pendingChoices = {
    augment: { round: 1, options: ["tempo", "spring", "bastion"] },
  };
  await t.render();
  const text = document.body.textContent;
  await act(() => window.dispatchEvent(new Event("resize")));
  expect(document.body.textContent).toBe(text);
  expect(text).not.toMatch(
    /secret-player-id|secret-unit-id|undefined|null|Preparing|Choosing/,
  );
});
it.each([
  [false, "Finished", true, true, "shop", "connection"],
  [true, "Finished", true, true, "shop", "finished"],
  [true, "Choosing", true, true, "shop", "item"],
  [true, "Choosing", false, true, "shop", "augment"],
  [true, "Preparing", false, false, "shop", "shop"],
] as const)(
  "prioritizes overlays (%s %s %s %s)",
  (connected, phase, item, augment, panel, expected) =>
    expect(overlayPriority(connected, phase, item, augment, panel)).toBe(
      expected,
    ),
);

it("backdrop dismisses voluntary overlays but never mandatory choices", async () => {
  const t = setup();
  await t.render();
  await click("Shop");
  await act(() =>
    document
      .querySelector(".hud-backdrop")!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  t.props.state.room.phase = "Choosing";
  t.props.state.room.players[0].pendingChoices = {
    item: { round: 1, options: ["sunshard", "heartglass", "moonwell"] },
  };
  await t.render();
  await act(() =>
    document
      .querySelector(".hud-backdrop")!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
  );
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});
it("resolving keeps summary outside document flow and finished actions work", async () => {
  const t = setup();
  t.props.state.room.phase = "Resolving";
  t.props.state.room.players[0].lastResult = "Victory";
  await t.render();
  expect(t.host.querySelector(".hud-board-caption")?.textContent).toBe(
    "Victory",
  );
  expect(t.host.querySelector(".round-insights")).toBeNull();
  t.props.state.room.phase = "Finished";
  await t.render();
  await click("Play again");
  expect(t.props.onAgain).toHaveBeenCalledOnce();
  await click("Home");
  expect(t.props.onHome).toHaveBeenCalledOnce();
});
it("summary retains opponent and readable events after replay is cleared", async () => {
  const t = setup(),
    own = player("private-own", [
      unit("pyre", "private-recruit", 18, 2, ["moonwell"]),
    ]),
    enemy = player("private-enemy", [unit("rivet", "private-target", 18)]);
  enemy.name = "Opponent";
  const battle = simulate(own, enemy, 11, false, 1),
    summary = combatSummary(battle, own, enemy, true, 0, 1);
  expect(summary.events!.length).toBeGreaterThan(0);
  expect(JSON.stringify(summary.events)).not.toMatch(/private-/);
  t.props.state.room.players[0].latestSummary = structuredClone(summary);
  t.props.state.room.battles = [];
  await t.render();
  await click("Round summary");
  expect(document.querySelector('[role="tabpanel"]')?.textContent).toContain(
    "Opponent",
  );
  await click("Events");
  expect(
    document.querySelector('[role="tabpanel"]')?.textContent,
  ).not.toContain("No data yet");
});
it("team statistics expose sortable healing and shield without raw IDs", async () => {
  const own = player("private-own", [unit("pyre", "private-recruit", 18)]),
    enemy = player("private-enemy", [unit("rivet", "private-target", 18)]),
    stats = simulate(own, enemy, 11, false, 1).stats!;
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root!.render(<TeamStatistics snapshot={stats} locale="en" />),
  );
  const select = host.querySelector("select")!;
  await act(() => {
    select.value = "healingDone";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(select.value).toBe("healingDone");
  expect(host.textContent).toContain("Shield granted");
  expect(host.textContent).not.toMatch(/private-|undefined|null/);
});
