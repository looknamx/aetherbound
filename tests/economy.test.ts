import { describe, expect, it } from "vitest";
import {
  addXP,
  buy,
  equip,
  income,
  mergeUnits,
  move,
  rollShop,
  sell,
  synergies,
} from "../shared/economy";
import {
  ITEMS,
  ODDS,
  UNIT_MAP,
  UNITS,
  validateContent,
} from "../shared/content";
import { RNG } from "../shared/random";
import { player, unit } from "./helpers";
describe("economy and content", () => {
  it("validates 18 original units, 12 items and probability tables", () => {
    expect(validateContent).not.toThrow();
    expect(UNITS).toHaveLength(18);
    expect(ITEMS).toHaveLength(12);
    for (const odds of ODDS) expect(odds.reduce((a, b) => a + b)).toBe(100);
  });
  it("buys, deducts exact cost, and sells with all items returned", () => {
    const p = player();
    buy(p, 0, "new");
    expect(p.gold).toBe(49);
    expect(p.shop[0]).toBeNull();
    p.units[0].items = ["sunshard"];
    sell(p, "new");
    expect(p.gold).toBe(50);
    expect(p.inventory).toEqual(["sunshard"]);
    expect(p.units).toHaveLength(0);
  });
  it("rejects overspending and repeat purchase without mutation", () => {
    const p = player();
    p.gold = 0;
    expect(() => buy(p, 0, "x")).toThrow();
    expect(p.shop[0]).toBe("cinder");
    p.gold = 1;
    buy(p, 0, "x");
    expect(() => buy(p, 0, "y")).toThrow();
    expect(p.gold).toBe(0);
  });
  it("merges across board and bench and keeps overflow relics", () => {
    const p = player("p", [
      unit("cinder", "a", 0, 1, ["sunshard", "ironleaf"]),
      unit("cinder", "b", 36, 1, ["moonwell"]),
      unit("cinder", "c", 37, 1, ["dawnshell"]),
    ]);
    mergeUnits(p);
    expect(p.units).toHaveLength(1);
    expect(p.units[0]).toMatchObject({ id: "a", star: 2, slot: 0 });
    expect(p.units[0].items).toHaveLength(3);
    expect(p.inventory).toEqual(["dawnshell"]);
  });
  it("cascades nine 1-star units into 3-star and never makes 4-star", () => {
    const p = player(
      "p",
      Array.from({ length: 9 }, (_, i) => unit("cinder", String(i), i)),
    );
    mergeUnits(p);
    expect(p.units).toHaveLength(1);
    expect(p.units[0].star).toBe(3);
    p.units.push(unit("cinder", "b", 36, 3), unit("cinder", "c", 37, 3));
    mergeUnits(p);
    expect(p.units).toHaveLength(3);
  });
  it("allows a merging purchase on a full bench and rejects a nonmerging one", () => {
    const p = player(
      "p",
      Array.from({ length: 8 }, (_, i) =>
        unit(i < 2 ? "cinder" : UNITS[i].id, String(i), 36 + i),
      ),
    );
    buy(p, 0, "new");
    expect(p.units).toHaveLength(7);
    expect(p.units.every((u) => u.slot <= 43)).toBe(true);
    p.units.push(unit("brook", "extra", 37));
    expect(() => buy(p, 3, "bad")).toThrow("bench");
  });
  it("enforces field limits, swaps, and slot bounds", () => {
    const p = player("p", [
      unit("cinder", "a", 0),
      unit("brook", "b", 1),
      unit("rivet", "c", 36),
    ]);
    expect(() => move(p, "c", 2)).toThrow("Field");
    move(p, "c", 0);
    expect(p.units.find((u) => u.id === "a")!.slot).toBe(36);
    expect(() => move(p, "c", 44)).toThrow();
    expect(() => move(p, "other", 4)).toThrow();
  });
  it("equips at most 3 owned relics and can move relics back", () => {
    const p = player("p", [unit()]);
    p.inventory = ["sunshard", "moonwell", "ironleaf", "dawnshell"];
    equip(p, "u1", 0);
    equip(p, "u1", 0);
    equip(p, "u1", 0);
    expect(() => equip(p, "u1", 0)).toThrow("3");
    equip(p, "u1", 0, true);
    expect(p.inventory).toEqual(["dawnshell", "sunshard"]);
    expect(() => equip(p, "other", 0)).toThrow();
  });
  it("levels from XP and grants capped interest plus streak income", () => {
    const p = player();
    p.gold = 99;
    p.streak = -6;
    expect(income(p)).toBe(13);
    addXP(p, 4);
    expect(p.level).toBe(3);
    expect(p.xp).toBe(0);
    addXP(p, 1000);
    expect(p.level).toBe(8);
    expect(p.xp).toBe(0);
  });
  it("counts unique recruits rather than duplicate copies for synergies", () => {
    const p = player("p", [
      unit("cinder", "a", 0),
      unit("cinder", "b", 1),
      unit("flare", "c", 2),
      unit("pyre", "d", 36),
    ]);
    const t = synergies(p.units).find((t) => t.id === "Emberkin")!;
    expect(t.count).toBe(2);
    expect(t.tier).toBe(1);
  });
  it("is seeded, respects rarity support, and matches level-8 probabilities", () => {
    expect(rollShop(8, new RNG(42))).toEqual(rollShop(8, new RNG(42)));
    const rng = new RNG(17),
      counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 2000; i++)
      for (const id of rollShop(8, rng)) counts[UNIT_MAP[id!].cost - 1]++;
    counts.forEach((n, i) =>
      expect(Math.abs(n / 100 - ODDS[7][i])).toBeLessThan(2),
    );
    for (const id of rollShop(1, rng)) expect(UNIT_MAP[id!].cost).toBe(1);
  });
});
