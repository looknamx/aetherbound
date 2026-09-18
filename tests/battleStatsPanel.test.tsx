import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LatestBattleStatsPanel,
  formatDamage,
} from "../client/cards/LatestBattleStatsPanel";
import { simulate } from "../shared/combat";
import { player, unit } from "./helpers";
it("renders missing data distinctly from zero and labels concurrent rounds", () => {
  const html = renderToStaticMarkup(
    <LatestBattleStatsPanel battling round={2} />,
  );
  expect(html).toContain("ยังไม่มีข้อมูล");
  expect(html).toContain("กำลังต่อสู้รอบ 2");
});
it("renders comparison labels, exact values, portraits, stars and sort controls", () => {
  const snapshot = simulate(
    player("p", [unit()]),
    player("q", [unit("rivet", "b")]),
    1,
    false,
    4,
  ).stats!;
  const html = renderToStaticMarkup(
    <LatestBattleStatsPanel snapshot={snapshot} battling={false} round={5} />,
  );
  for (const text of [
    "Round 4",
    "Damage Dealt",
    "Damage Taken",
    "ตำแหน่งเดิมในทีม",
    "Cinder Sentry",
    "<svg",
    "<meter",
    "ค่าจริง",
  ])
    expect(html).toContain(text);
  expect(formatDamage(950)).toBe("950");
  expect(formatDamage(1200)).toBe("1.2K");
  expect(formatDamage(15800)).toBe("15.8K");
});
