import { describe, expect, it } from "vitest";
import {
  BattleStatsCollector,
  hpDamage,
  sortBattleStats,
} from "../shared/battleStats";
import { damageAfterResistance, simulate } from "../shared/combat";
import { GameEngine } from "../server/engine";
import { mergeUnits, sell } from "../shared/economy";
import { player, unit } from "./helpers";
import type { CombatEvent, Fighter } from "../shared/types";
function setup() {
  const c = new BattleStatsCollector("battle", 1);
  const f = (id: string): Fighter => ({
    id,
    unitId: id,
    defId: "cinder",
    star: 1,
    side: 0,
    x: 0,
    y: 3,
    hp: 100,
    maxHp: 100,
    mana: 0,
    shield: 0,
    status: [],
  });
  c.register(f("a"), "p", 18);
  c.register(f("b"), "q", 19);
  return {
    c,
    f,
    hit: (value: number, extra: Partial<CombatEvent> = {}) =>
      c.record({
        tick: 1,
        type: "damage",
        source: "a",
        target: "b",
        value,
        ...extra,
      }),
  };
}
describe("authoritative per-instance battle statistics", () => {
  it("counts friendly fire between a summon and its owner without confusing it with self-damage", () => {
    const { c, f, hit } = setup();
    c.register({ ...f("echo"), summon: true }, "p", -1, "a");
    hit(6, { source: "echo", target: "a" });
    hit(4, { source: "echo", target: "echo" });
    expect(c.snapshot().units[0]).toMatchObject({
      damageDealt: 6,
      damageTaken: 10,
    });
  });
  it("a three-player echo does not overwrite the defender's primary battle statistics", () => {
    const engine = new GameEngine(),
      s = engine.create("A");
    engine.join(s.key, "B");
    engine.join(s.key, "C");
    const room = engine.rooms.get(s.key)!;
    for (const p of room.players) p.units = [unit("cinder", p.id, 18)];
    engine.prepare(room);
    engine.battle(room);
    const echo = room.battles.find((b) => b.ghost)!;
    const primary = room.battles.find(
      (b) => !b.ghost && (b.a === echo.b || b.b === echo.b),
    )!;
    engine.resolve(room);
    expect(
      room.players.find((p) => p.id === echo.b)!.latestBattleStats!.battleId,
    ).toBe(primary.id);
    expect(
      room.players.find((p) => p.id === echo.a)!.latestBattleStats!.battleId,
    ).toBe(echo.id);
  });
  it("counts equal dealt/taken for normal and armor-reduced HP loss", () => {
    const { c, hit } = setup();
    const n = damageAfterResistance(100, 50);
    hit(hpDamage(n, 100, 0).damage);
    expect(
      c.snapshot().units.map((u) => [u.damageDealt, u.damageTaken]),
    ).toEqual([
      [67, 0],
      [0, 67],
    ]);
  });
  it("caps overkill at remaining HP and excludes shield absorption", () => {
    expect(hpDamage(80, 20, 0)).toEqual({ damage: 20, absorbed: 0 });
    expect(hpDamage(80, 20, 70)).toEqual({ damage: 10, absorbed: 70 });
    expect(hpDamage(80, 20, 100)).toEqual({ damage: 0, absorbed: 80 });
    const { c, hit } = setup();
    hit(10, { absorbed: 70 });
    expect(c.snapshot().units[1]).toMatchObject({
      damageTaken: 10,
      damageAbsorbed: 70,
    });
  });
  it("attributes repeated DoT events to their original source even after its death", () => {
    const { c, hit } = setup();
    c.record({ tick: 1, type: "death", source: "a" });
    for (let tick = 2; tick <= 4; tick++) hit(5, { tick, text: "dot" });
    expect(c.snapshot().units[0].damageDealt).toBe(15);
  });
  it("separates healing and clamps negative damage", () => {
    const { c, hit } = setup();
    hit(-20);
    c.record({ tick: 1, type: "heal", source: "a", target: "b", value: 20 });
    expect(c.snapshot().units[0]).toMatchObject({
      damageDealt: 0,
      healingDone: 20,
    });
    expect(hpDamage(-20, 10, 10)).toEqual({ damage: 0, absorbed: 0 });
  });
  it("counts self-damage only as taken, friendly fire by actual identities", () => {
    const { c, hit } = setup();
    hit(10, { target: "a" });
    hit(5);
    expect(c.snapshot().units[0]).toMatchObject({
      damageDealt: 5,
      damageTaken: 10,
    });
    expect(c.snapshot().units[1].damageTaken).toBe(5);
  });
  it("aggregates summon damage and damage taken to its owner; orphan summons get separate rows", () => {
    const { c, f, hit } = setup();
    c.register({ ...f("echo"), unitId: undefined, summon: true }, "p", -1, "a");
    c.register(
      { ...f("orphan"), unitId: undefined, summon: true },
      "p",
      -1,
      "missing",
    );
    hit(30, { source: "echo" });
    hit(12, { source: "b", target: "echo" });
    hit(7, { source: "orphan" });
    expect(c.snapshot().units).toHaveLength(3);
    expect(c.snapshot().units[0]).toMatchObject({
      damageDealt: 30,
      damageTaken: 12,
    });
    expect(c.snapshot().units[2]).toMatchObject({
      unitId: "orphan",
      damageDealt: 7,
      summoned: true,
    });
  });
  it("keeps same-definition instances separate, supports sorting without mutating snapshot", () => {
    const { c, hit } = setup();
    hit(50);
    hit(20, { source: "b", target: "a" });
    const snapshot = c.snapshot();
    expect(
      sortBattleStats(snapshot.units, "damageDealt").map((u) => u.unitId),
    ).toEqual(["a", "b"]);
    expect(
      sortBattleStats(snapshot.units, "damageTaken").map((u) => u.unitId),
    ).toEqual(["b", "a"]);
    expect(
      sortBattleStats(snapshot.units, "position").map((u) => u.unitId),
    ).toEqual(["a", "b"]);
    expect(snapshot.units.map((u) => u.unitId)).toEqual(["a", "b"]);
  });
  it("simulator totals equal authoritative damage events, including dead recruits and instance mapping", () => {
    const battle = simulate(
      player("p", [unit("pyre", "a", 18, 3)]),
      player("q", [unit("cinder", "b", 18)]),
      12,
      false,
      3,
    );
    const events = battle.frames
      .flatMap((f) => f.events)
      .filter((e) => e.type === "damage");
    expect(
      battle.stats!.units.reduce((n, u) => n + u.damageDealt, 0),
    ).toBeCloseTo(events.reduce((n, e) => n + (e.value ?? 0), 0));
    expect(
      battle.stats!.units.reduce((n, u) => n + u.damageTaken, 0),
    ).toBeCloseTo(events.reduce((n, e) => n + (e.value ?? 0), 0));
    expect(battle.frames.at(-1)!.units.some((u) => u.hp === 0)).toBe(true);
    expect(battle.stats!.units).toHaveLength(2);
    expect(battle.stats).toMatchObject({
      version: 1,
      round: 3,
      battleId: battle.id,
    });
    expect(battle.frames[0].units[0]).toMatchObject({
      unitId: "a",
      ownerId: "p",
      id: "0:a",
    });
  });
  it("round snapshots survive preparation, merge, sale and reconnect; next battle starts fresh", () => {
    const e = new GameEngine(),
      session = e.create("A");
    e.join(session.key, "B");
    const r = e.rooms.get(session.key)!,
      p = r.players[0];
    p.units = [unit("cinder", "a", 18)];
    r.players[1].units = [unit("rivet", "b", 18)];
    e.prepare(r);
    e.battle(r);
    e.resolve(r);
    const previous = structuredClone(p.latestBattleStats);
    expect(previous?.round).toBe(1);
    e.prepare(r);
    p.units.push(unit("cinder", "c", 36), unit("cinder", "d", 37));
    mergeUnits(p);
    sell(p, "a");
    expect(p.latestBattleStats).toEqual(previous);
    e.reconnect(session.token);
    expect(p.latestBattleStats).toEqual(previous);
    e.battle(r);
    expect(r.battles[0].stats!.round).toBe(2);
    expect(r.battles[0].stats!.units.filter((u) => u.ownerId === p.id)).toEqual(
      [],
    );
    expect(p.latestBattleStats).toEqual(previous);
    e.resolve(r);
    expect(p.latestBattleStats).toMatchObject({ round: 2, units: [] });
  });
});
