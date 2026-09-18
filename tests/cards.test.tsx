import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UnitCard } from "../client/cards/UnitCard";
import { battleStats, defenseRating, permanentStats } from "../shared/stats";
import { simulate } from "../shared/combat";
import { player, unit } from "./helpers";
describe("shared card statistics", () => {
  it("DEF is rounded equal-weight armor/MR including negatives", () => {
    expect(defenseRating(32, 12)).toBe(22);
    expect(defenseRating(15, 12)).toBe(14);
    expect(defenseRating(-20, 10)).toBe(-5);
  });
  it("ATK and DEF include stars and permanent relics", () => {
    const stats = permanentStats(
      unit("cinder", "a", 18, 2, ["sunshard", "ironleaf", "mistcloak"]),
    );
    expect(stats.attack).toBeCloseTo(56 * 1.8 + 22);
    expect(stats.armor).toBe(57);
    expect(stats.resist).toBe(37);
    expect(defenseRating(stats.armor, stats.resist)).toBe(47);
  });
  it("server frames use the same calculation and show synergy deltas separately", () => {
    const a = player("a", [
        unit("cinder", "x", 18, 2, ["sunshard"]),
        unit("flare", "f", 19),
      ]),
      b = player("b", [unit("rivet", "y", 19)]);
    const expected = battleStats(a.units[0], a.units),
      fighter = simulate(a, b, 42).frames[0].units[0];
    expect(fighter.attack).toBe(expected.attack);
    expect(fighter.armor).toBe(expected.armor);
    expect(fighter.resist).toBe(expected.resist);
    const html = renderToStaticMarkup(
      <UnitCard unit={a.units[0]} fighter={fighter} variant="board" />,
    );
    expect(html).toContain(`ATK ${Math.round(expected.attack)}`);
    expect(html).toContain("stat-up");
    expect(html).toContain("Modifier +10");
  });
  it.each(["shop", "bench", "board", "detail", "drag", "preview"] as const)(
    "%s shows four corners from one unit definition",
    (variant) => {
      const html = renderToStaticMarkup(
        <UnitCard
          unit={unit("cinder", "x", 18, 2, ["sunshard", "ironleaf"])}
          variant={variant}
        />,
      );
      for (const corner of ["tl", "tr", "bl", "br"])
        expect(html).toContain(`data-corner="${corner}"`);
      for (const text of [
        "ATK 123",
        "DEF 35",
        "Role Tank",
        "Cost 1; Common",
        'data-def="cinder"',
        "Cinder Sentry",
        "2 stars",
        "2 of 3 relic slots",
      ])
        expect(html).toContain(text);
    },
  );
  it("details expose resistances, range, speed, mana, skill, traits and items", () => {
    const html = renderToStaticMarkup(
      <UnitCard
        unit={unit("nova", "a", 18, 1, ["moonwell"])}
        variant="detail"
      />,
    );
    for (const text of [
      "Magic resistance",
      "Attack speed",
      "Attack range",
      "Mana",
      "Nova Quiet Horizon",
      "Astral",
      "Arcanist",
      "Moonwell",
    ])
      expect(html).toContain(text);
  });
  it("live cards show health, mana, statuses, enemy team and negative modifiers", () => {
    const owned = unit("cinder"),
      f = simulate(player("a", [owned]), player("b", [unit("rivet", "b")]), 1)
        .frames[0].units[0];
    f.attack = 10;
    f.shield = 30;
    f.status = ["Stun", "Silence"];
    const html = renderToStaticMarkup(
      <UnitCard unit={owned} fighter={f} variant="board" side="enemy" />,
    );
    for (const text of [
      "side-enemy",
      "FOE",
      "Stun",
      "Silence",
      "Shield",
      'aria-label="Mana"',
      "stat-down",
    ])
      expect(html).toContain(text);
  });
});
