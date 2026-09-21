import { describe, it, expect } from "vitest";
import { GameEngine } from "../server/engine";
import {
  initializePool,
  assertPool,
  pooledShop,
  releaseShop,
  returnUnit,
  eliminateSupply,
  reserve,
  shopOdds,
} from "../shared/pool";
import { buy, sell, mergeUnits, equip, income } from "../shared/economy";
import { offerChoices, choose, drainRewards } from "../shared/choices";
import {
  AUGMENTS,
  AUGMENT_MAP,
  eligibleAugments,
} from "../shared/strategyConfig";
import { battleStats } from "../shared/stats";
import { incomeBreakdown, synergyAdvice } from "../shared/roundInsights";
import { migrateRoom } from "../shared/migration";
import { RNG } from "../shared/random";
import { player, unit } from "./helpers";
import { simulate } from "../shared/combat";
import {
  EventCursor,
  structuredEventSchema,
  eventLabel,
} from "../shared/combatEvents";
function room() {
  const e = new GameEngine(),
    s = e.create("A");
  e.join(s.key, "B");
  return { e, s, r: e.rooms.get(s.key)! };
}
describe("finite reserved supply", () => {
  it("rolls, buys, refreshes, locks and expires offers while conserving every copy", () => {
    const { e, s, r } = room();
    e.prepare(r);
    assertPool(r);
    const p = r.players[0],
      id = p.shop[0]!,
      before = r.pool!.available[id];
    e.action(s, "buy", { type: "buy", index: 0 });
    expect(r.pool!.available[id]).toBe(before);
    assertPool(r);
    e.action(s, "buy", { type: "buy", index: 0 });
    expect(p.units).toHaveLength(1);
    p.gold = 100;
    e.action(s, "roll", { type: "reroll" });
    assertPool(r);
    p.locked = true;
    const offers = [...p.shop];
    e.prepare(r);
    expect(p.shop).toEqual(offers);
    assertPool(r);
    releaseShop(r, p);
    assertPool(r);
    expect(p.shop.every((x) => x === null)).toBe(true);
  });
  it.each([1, 2, 3] as const)(
    "returns all copies of a %i-star unit on sale",
    (star) => {
      const { r } = room(),
        p = r.players[0];
      p.shop = [];
      p.units = [unit("cinder", "u", 18, star)];
      initializePool(r);
      const n = r.pool!.available.cinder,
        u = p.units[0];
      sell(p, u.id);
      returnUnit(r, u);
      expect(r.pool!.available.cinder - n).toBe(3 ** (star - 1));
      assertPool(r);
    },
  );
  it("merges without releasing copies, returns all supply on elimination", () => {
    const { r } = room(),
      p = r.players[0];
    p.units = [
      unit("cinder", "1", 18),
      unit("cinder", "2", 36),
      unit("cinder", "3", 37),
    ];
    initializePool(r);
    const n = r.pool!.available.cinder;
    mergeUnits(p);
    expect(r.pool!.available.cinder).toBe(n);
    assertPool(r);
    eliminateSupply(r, p);
    assertPool(r);
    expect(r.pool!.available.cinder).toBe(r.pool!.total.cinder);
  });
  it("reserves the last copy once, bounds exhausted-tier fallback and never goes negative", () => {
    const { r } = room();
    for (const id of Object.keys(r.pool!.available)) {
      r.pool!.available[id] = 0;
      r.pool!.total[id] = 0;
    }
    r.pool!.available.cinder = 1;
    r.pool!.total.cinder = 1;
    const a = r.players[0],
      b = r.players[1];
    pooledShop(r, a, new RNG(5));
    pooledShop(r, b, new RNG(5));
    expect([...a.shop, ...b.shop].filter(Boolean)).toEqual(["cinder"]);
    assertPool(r);
    expect(() => reserve(r, "cinder")).toThrow();
    buy(a, 0, "owned");
    assertPool(r);
    expect(() => buy(b, 0, "fake")).toThrow();
  });
  it("rebuilds missing legacy pool once and validates serialized reserved supply", () => {
    const { e, r } = room();
    e.prepare(r);
    const restored = migrateRoom(JSON.parse(JSON.stringify(r)));
    expect(restored.pool).toEqual(r.pool);
    delete restored.pool;
    delete restored.schemaVersion;
    expect(migrateRoom(restored).pool).toEqual(r.pool);
    const corrupt = structuredClone(r);
    corrupt.pool!.available.cinder--;
    expect(() => migrateRoom(corrupt)).toThrow("invariant");
  });
});
describe("private choices", () => {
  it("offers three distinct seeded choices and one award per choice", () => {
    const p = player(),
      q = player();
    offerChoices(p, 5, new RNG(42));
    offerChoices(q, 5, new RNG(42));
    expect(p.pendingChoices).toEqual(q.pendingChoices);
    expect(new Set(p.pendingChoices!.item!.options).size).toBe(3);
    expect(new Set(p.pendingChoices!.augment!.options).size).toBe(3);
    expect(() => choose(p, "item", 5, 3)).toThrow();
    expect(() => choose(p, "item", 4, 0)).toThrow();
    const id = p.pendingChoices!.item!.options[0];
    choose(p, "item", 5, 0);
    expect(p.inventory).toEqual([id]);
    expect(() => choose(p, "item", 5, 0)).toThrow();
  });
  it("preserves full-inventory rewards until an inventory slot opens", () => {
    const p = player();
    p.inventory = Array(90).fill("sunshard");
    p.units = [unit()];
    offerChoices(p, 1, new RNG(3));
    const id = p.pendingChoices!.item!.options[0];
    choose(p, "item", 1, 0);
    expect(p.rewardOverflow).toEqual([id]);
    equip(p, "u1", 0);
    drainRewards(p);
    expect(p.inventory).toHaveLength(90);
    expect(p.inventory.at(-1)).toBe(id);
    expect(p.rewardOverflow).toEqual([]);
  });
  it("rejects stale/duplicate choice commands, reconnect keeps offers and timeout picks deterministically", () => {
    let clock = 1000;
    const e = new GameEngine(
        () => {},
        () => clock,
      ),
      s = e.create("A");
    e.join(s.key, "B");
    const r = e.rooms.get(s.key)!;
    e.prepare(r);
    e.battle(r);
    e.resolve(r);
    e.beginChoices(r);
    expect(r.phase).toBe("Choosing");
    const before = structuredClone(r.players[0].pendingChoices);
    e.reconnect(s.token);
    expect(r.players[0].pendingChoices).toEqual(before);
    const p = r.players[0],
      n = p.inventory.length;
    e.action(s, "choose-once", {
      type: "choose",
      kind: "item",
      round: 1,
      index: 1,
    });
    e.action(s, "choose-once", {
      type: "choose",
      kind: "item",
      round: 1,
      index: 1,
    });
    expect(p.inventory).toHaveLength(n + 1);
    const b = r.players[1],
      expected = b.pendingChoices!.item!.options[0];
    clock = r.deadline + 1;
    e.tick(clock);
    expect(b.inventory).toContain(expected);
    expect(r.phase).toBe("Preparing");
    expect(() =>
      e.action(s, "late-choice", {
        type: "choose",
        kind: "item",
        round: 1,
        index: 0,
      }),
    ).toThrow();
  });
});
describe("all twelve augments have actual effects", () => {
  const units = [
      unit("cinder", "u", 18, 1, ["sunshard"]),
      unit("lumen", "r", 32),
    ],
    base = battleStats(units[0], units, [], 3);
  it.each([
    ["bastion", "armor", 18],
    ["tempo", "speed", base.speed * 0.12],
    ["spring", "mana", 20],
    ["artisan", "attack", 22 * 0.25],
    ["embers", "attack", 20],
    ["rookies", "maxHp", 180],
    ["outnumbered", "shield", 150],
  ] as const)("%s modifies %s", (id, key, delta) => {
    expect(battleStats(units[0], units, [id], 3)[key]).toBeCloseTo(
      base[key] + delta,
    );
  });
  it("back-row range, shop weights, income/streak and reroll price affect their sources of truth", () => {
    expect(battleStats(units[1], units, ["lookout"]).range).toBe(
      battleStats(units[1], units).range + 1,
    );
    const p = player();
    p.level = 5;
    p.augments = ["discovery"];
    expect(shopOdds(p)[2]).toBeGreaterThan(shopOdds({ ...p, augments: [] })[2]);
    p.streak = -3;
    p.augments = ["resolve"];
    expect(incomeBreakdown(p, false, 2).augment).toBe(2);
    p.augments = ["stipend"];
    expect(incomeBreakdown(p, false, 2).augment).toBe(1);
    const { e, s, r } = room();
    e.prepare(r);
    r.players[0].augments = ["bargain"];
    r.players[0].gold = 1;
    e.action(s, "discount", { type: "reroll" });
    expect(r.players[0].gold).toBe(0);
  });
  it("does not stack duplicate bonuses and excludes conflict tags", () => {
    expect(AUGMENTS).toHaveLength(12);
    expect(battleStats(units[0], units, ["embers", "embers"]).attack).toBe(
      base.attack + 20,
    );
    expect(eligibleAugments(["stipend"]).some((a) => a.id === "resolve")).toBe(
      false,
    );
    const p = player();
    p.augments = ["stipend"];
    p.pendingChoices = {
      augment: { round: 2, options: ["resolve", "embers", "tempo"] },
    };
    expect(() => choose(p, "augment", 2, 0)).toThrow();
    for (const id of Object.keys(AUGMENT_MAP))
      expect(AUGMENT_MAP[id].descriptionEn).toBeTruthy();
  });
});
describe("synergy and economy explain actual rules", () => {
  it("ignores bench, distinguishes progress/activation/duplicates and warns about full boards", () => {
    const p = player("p", [unit("cinder", "a", 18), unit("rivet", "b", 36)]);
    const advice = synergyAdvice(p, "rivet").find((a) => a.trait === "Warden")!;
    expect(advice).toMatchObject({
      current: 1,
      next: 2,
      kind: "activate",
      needsReplacement: false,
    });
    expect(
      synergyAdvice(p, "cinder").every((a) => a.duplicate && a.kind === "none"),
    ).toBe(true);
    p.units.push(unit("lumen", "c", 19));
    expect(synergyAdvice(p, "rivet").every((a) => a.needsReplacement)).toBe(
      true,
    );
    expect(
      synergyAdvice(player(), "rivet").every((a) => a.kind === "progress"),
    ).toBe(true);
  });
  it.each([0, 9, 10, 21, 50, 99])(
    "income components match actual gold at %i gold",
    (gold) => {
      const p = player();
      p.gold = gold;
      p.streak = 4;
      p.augments = ["stipend"];
      const b = incomeBreakdown(p, true, 1);
      expect(b.total).toBe(income(p) + 2);
      expect(b.after - b.before).toBe(b.total);
      expect(b.total).toBe(
        b.base +
          b.interest +
          b.win +
          b.loss +
          b.winStreak +
          b.loseStreak +
          b.augment +
          b.other -
          b.capped,
      );
    },
  );
});
describe("structured combat events", () => {
  it("has deterministic validated sequences, actual casts, broken shields, one death per unit and no IDs in labels", () => {
    const a = player("a", [
        unit("pyre", "uuid-secret-a", 18, 3, ["moonwell", "moonwell"]),
      ]),
      b = player("b", [
        unit("rivet", "uuid-secret-b", 18),
        unit("cinder", "other", 19),
      ]);
    const result = simulate(a, b, 7),
      events = result.frames.flatMap((f) => f.events);
    expect(result).toEqual(simulate(a, b, 7));
    expect(events.map((e) => e.sequence)).toEqual(events.map((_, i) => i));
    for (const e of events)
      expect(() => structuredEventSchema.parse(e)).not.toThrow();
    expect(events.some((e) => e.kind === "SkillCastStarted")).toBe(true);
    expect(events.some((e) => e.kind === "ShieldBroken")).toBe(true);
    const dead = events.filter((e) => e.kind === "UnitDied");
    expect(new Set(dead.map((e) => e.source)).size).toBe(dead.length);
    for (const frame of result.frames)
      for (const e of frame.events)
        expect(eventLabel(e, frame) ?? "").not.toMatch(
          /uuid-secret|other|undefined|null|NaN/,
        );
  });
  it("drops duplicate and late events, resumes at cursor and resets for next battle", () => {
    const events = simulate(
        player("a", [unit()]),
        player("b", [unit("rivet", "b")]),
        1,
      ).frames.flatMap((f) => f.events),
      cursor = new EventCursor();
    expect(cursor.consume("a", [events[0], events[0]])).toHaveLength(1);
    expect(cursor.consume("a", [events[0]])).toEqual([]);
    cursor.reset("a", events.at(-1)!.sequence);
    expect(cursor.consume("a", events)).toEqual([]);
    expect(cursor.consume("b", events)).toHaveLength(events.length);
  });
});
