// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { LatestBattleStatsPanel } from "../client/cards/LatestBattleStatsPanel";
import {
  battleStatsDisplay,
  exactDamage,
  formatDamage,
  STAT_LABELS,
} from "../client/cards/battleStatsDisplay";
import type { BattleStatsSnapshot } from "../shared/types";
import { simulate } from "../shared/combat";
import { player, unit } from "./helpers";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const secretIds = [
  "13956573-070c-4d8e-8cbe-dfcd1d7599fb",
  "1c1530dd-9cd2-4385-9655-058b7371f8f9",
  "4b7ab8fa-0f8c-4b98-b44f-6efb889caf6c",
];
function fixture() {
  const snapshot = simulate(
    player("p", [unit()]),
    player("q", [unit("rivet", "b")]),
    1,
    false,
    4,
  ).stats!;
  snapshot.battleId = secretIds[0];
  snapshot.units = [
    {
      ...snapshot.units[0],
      unitId: secretIds[1],
      combatUnitId: secretIds[2],
      ownerId: secretIds[0],
      damageDealt: 1540,
      damageTaken: 510,
      damageAbsorbed: 80,
      skillCasts: 2,
    },
  ];
  Object.assign(snapshot, {
    matchId: secretIds[1],
    zoneId: secretIds[2],
    roomId: secretIds[0],
    socketId: secretIds[1],
    databaseId: secretIds[2],
    seed: 195222997,
    coordinateKey: "internal-coordinate-secret",
    debugMetadata: { privateValue: secretIds[0] },
  });
  return snapshot;
}
const render = (snapshot?: BattleStatsSnapshot) =>
  renderToStaticMarkup(
    <LatestBattleStatsPanel snapshot={snapshot} battling={false} round={5} />,
  );
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(() => root!.unmount());
  root = undefined;
  document.body.replaceChildren();
});
async function mount(snapshot = fixture()) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() =>
    root!.render(
      <LatestBattleStatsPanel snapshot={snapshot} battling={false} round={5} />,
    ),
  );
  return container;
}
it("renders Thai labels, recorded round, real exact values and only available extra counters", () => {
  const html = render(fixture());
  for (const text of [
    "รอบ 4",
    STAT_LABELS.damageDealt,
    STAT_LABELS.damageTaken,
    "1,540",
    "510",
    "1.5 พัน",
    STAT_LABELS.absorbed,
    STAT_LABELS.casts,
    "Cinder Sentry",
    "<meter",
    "<svg",
  ])
    expect(html).toContain(text);
  expect(html).not.toMatch(
    /Damage Dealt|Damage Taken|Round|Zone|stars|สถานะ:|กายภาพ|เวทมนตร์/,
  );
});
it("does not expose UUIDs or any internal metadata anywhere in markup, including titles and aria labels", () => {
  const html = render(fixture());
  for (const id of [
    ...secretIds,
    "195222997",
    "internal-coordinate-secret",
    "debugMetadata",
    "battleId",
    "zoneId",
    "matchId",
    "unitId",
    "socketId",
  ])
    expect(html).not.toContain(id);
  expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
});
it("display projection contains only allowed fields and never reads debug metadata", () => {
  const snapshot = fixture();
  Object.defineProperty(snapshot, "metadata", {
    get() {
      throw Error("metadata read");
    },
  });
  const display = battleStatsDisplay(snapshot);
  expect(Object.keys(display).sort()).toEqual([
    "recordedRound",
    "rows",
    "title",
  ]);
  expect(Object.keys(display.rows[0]).sort()).toEqual([
    "damageDealt",
    "damageTaken",
    "name",
    "portrait",
    "position",
    "shieldAbsorbed",
    "skillCasts",
    "stars",
  ]);
});
it.each([
  undefined,
  null,
  NaN,
  Infinity,
  "13956573-070c-4d8e-8cbe-dfcd1d7599fb",
  {},
  0,
  -1,
  1.5,
])("missing/invalid round %s never falls back to an identifier", (value) => {
  const snapshot = fixture();
  snapshot.round = value as number;
  const html = render(snapshot);
  expect(html).toContain("สถิติการต่อสู้ล่าสุด");
  expect(html).not.toContain("บันทึกจาก");
  expect(html).not.toMatch(/undefined|null|NaN|\[object Object\]|13956573-/);
});
it.each([undefined, null, NaN, Infinity, -1, {}, "123"])(
  "invalid damage %s becomes missing data, never a raw value",
  (value) => {
    const snapshot = fixture();
    Object.assign(snapshot.units[0], {
      damageDealt: value,
      damageTaken: value,
      damageAbsorbed: value,
      skillCasts: value,
    });
    const html = render(snapshot);
    expect(html).toContain("—");
    expect(html).not.toMatch(/undefined|null|NaN|Infinity|\[object Object\]/);
  },
);
it("preserves zero, fractional and million-scale numbers without truncating exact detail values", () => {
  expect(exactDamage(0)).toBe("0");
  expect(exactDamage(1234567.125)).toBe("1,234,567.125");
  expect(formatDamage(950)).toBe("950");
  expect(formatDamage(15800)).toBe("15.8 พัน");
  expect(formatDamage(1234567.125)).toBe("1.2 ล้าน");
  const snapshot = fixture();
  snapshot.units[0].damageDealt = 1234567.125;
  snapshot.units[0].damageTaken = 0;
  const html = render(snapshot);
  expect(html).toContain("1,234,567.125");
  expect(html).toContain('value="0"');
});
it("shows missing stats and a safe current round label", () => {
  expect(render()).toContain("ยังไม่มีข้อมูล");
  expect(
    renderToStaticMarkup(<LatestBattleStatsPanel battling round={2} />),
  ).toContain("กำลังต่อสู้รอบ 2");
  expect(
    renderToStaticMarkup(<LatestBattleStatsPanel battling round={NaN} />),
  ).not.toContain("NaN");
});
it("unknown definitions and contaminated name/portrait fields never become ID fallbacks", () => {
  const snapshot = fixture();
  Object.assign(snapshot.units[0], {
    defId: secretIds[0],
    name: secretIds[1],
    portrait: secretIds[2],
  });
  const html = render(snapshot);
  expect(html).toContain("ตัวละครไม่ทราบชื่อ");
  for (const id of secretIds) expect(html).not.toContain(id);
});
it("keyboard Enter and Space toggle visibility and aria-expanded without double activation", async () => {
  const container = await mount();
  const button = container.querySelector<HTMLButtonElement>(
    ".stat-details-toggle",
  )!;
  const details = container.querySelector<HTMLElement>(
    `[id="${button.getAttribute("aria-controls")}"]`,
  )!;
  button.focus();
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(details.hidden).toBe(true);
  for (const [key, expanded] of [
    ["Enter", true],
    [" ", false],
    [" ", true],
    ["Enter", false],
  ] as const) {
    await act(() => {
      button.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
      button.dispatchEvent(
        new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }),
      );
    });
    expect(button.getAttribute("aria-expanded")).toBe(String(expanded));
    expect(details.hidden).toBe(!expanded);
  }
  await act(() => button.click());
  expect(details.hidden).toBe(false);
  expect(details.textContent).toContain("1,540");
  expect(details.textContent).toContain("บันทึกจากรอบ 4");
});
it("sort options expose only player labels, and changing sort changes the displayed order", async () => {
  const snapshot = fixture();
  snapshot.units.push({
    ...snapshot.units[0],
    defId: "rivet",
    damageDealt: 3,
    damageTaken: 9999,
    originalSlot: 18,
  });
  const container = await mount(snapshot),
    select = container.querySelector("select")!;
  expect(
    Array.from(select.options).map((option) => option.textContent),
  ).toEqual([
    STAT_LABELS.damageDealt,
    STAT_LABELS.damageTaken,
    STAT_LABELS.position,
  ]);
  expect(container.querySelector("li")!.textContent).toContain("Cinder Sentry");
  await act(() => {
    select.value = "damageTaken";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.querySelector("li")!.textContent).toContain("Rivet Guard");
});
it("panel and formatter have no generic object/metadata serialization path", () => {
  for (const file of ["LatestBattleStatsPanel.tsx", "battleStatsDisplay.ts"]) {
    const source = readFileSync(`client/cards/${file}`, "utf8");
    expect(source).not.toMatch(
      /JSON\.stringify|Object\.(?:entries|values)|snapshot\.(?:battleId|zoneId)|row\.(?:unitId|ownerId|combatUnitId)/,
    );
  }
});
