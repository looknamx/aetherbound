// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ScoutingPanel,
  ChoicePanel,
  PracticeEntry,
} from "../client/strategy/StrategyPanels";
import { LABELS } from "../client/strategy/labels";
import { scoutingView } from "../server/views";
import { player, unit } from "./helpers";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(() => root!.unmount());
  root = undefined;
  document.body.replaceChildren();
});
function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  return host;
}
it("scouting is read only, refreshes public state and returns automatically for combat", async () => {
  const host = mount(),
    p = player("Opponent", [unit("cinder", "secret-unit-id", 18)]),
    views = [scoutingView(p, 1)];
  await act(() =>
    root!.render(
      <ScoutingPanel views={views} ownSeat={0} phase="Preparing" locale="en">
        <div>Own board</div>
      </ScoutingPanel>,
    ),
  );
  await act(() => host.querySelector("button")!.click());
  expect(host.textContent).toContain("Opponent");
  expect(host.textContent).not.toContain("secret-unit-id");
  expect(host.querySelector("[draggable=true], [data-unit-id]")).toBeNull();
  expect(host.textContent).not.toContain("Own board");
  views[0].hp = 43;
  await act(() =>
    root!.render(
      <ScoutingPanel views={views} ownSeat={0} phase="Preparing" locale="en">
        <div>Own board</div>
      </ScoutingPanel>,
    ),
  );
  expect(host.textContent).toContain("43 HP");
  await act(() =>
    root!.render(
      <ScoutingPanel views={views} ownSeat={0} phase="Battling" locale="en">
        <div>Own board</div>
      </ScoutingPanel>,
    ),
  );
  expect(host.textContent).toContain("Own board");
  expect(host.querySelector(".scout-grid")).toBeNull();
});
it("choice buttons send option index and round, and disable when unavailable", async () => {
  const host = mount(),
    p = player(),
    send = vi.fn();
  p.pendingChoices = {
    augment: { round: 2, options: ["bastion", "tempo", "spring"] },
  };
  await act(() =>
    root!.render(
      <ChoicePanel player={p} locale="en" disabled={false} onAction={send} />,
    ),
  );
  expect(host.querySelectorAll("button")).toHaveLength(3);
  await act(() => host.querySelectorAll("button")[1].click());
  expect(send).toHaveBeenCalledWith({
    type: "choose",
    kind: "augment",
    round: 2,
    index: 1,
  });
  await act(() =>
    root!.render(
      <ChoicePanel player={p} locale="th" disabled onAction={send} />,
    ),
  );
  expect([...host.querySelectorAll("button")].every((b) => b.disabled)).toBe(
    true,
  );
  p.pendingChoices = {};
  await act(() =>
    root!.render(
      <ChoicePanel player={p} locale="en" disabled={false} onAction={send} />,
    ),
  );
  expect(host.querySelector("[role=status]")).not.toBeNull();
});
it("practice forwards selected difficulty and both locales have every label", async () => {
  const host = mount(),
    start = vi.fn();
  await act(() =>
    root!.render(
      <PracticeEntry locale="en" disabled={false} onStart={start} />,
    ),
  );
  const select = host.querySelector("select")!;
  await act(() => {
    select.value = "hard";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(() => host.querySelector("button")!.click());
  expect(start).toHaveBeenCalledWith("hard");
  expect(Object.keys(LABELS.th).sort()).toEqual(Object.keys(LABELS.en).sort());
});
