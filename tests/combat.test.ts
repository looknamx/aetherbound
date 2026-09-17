import { describe, expect, it } from "vitest";
import { damageAfterResistance, nextStep, simulate } from "../shared/combat";
import { UNITS } from "../shared/content";
import { player, unit } from "./helpers";
describe("deterministic combat", () => {
  it("applies physical and magical resistance with safe negative resistance", () => {
    expect(damageAfterResistance(100, 100)).toBe(50);
    expect(damageAfterResistance(100, 0)).toBe(100);
    expect(damageAfterResistance(100, -100)).toBe(150);
  });
  it("paths around occupied tiles and never leaves the grid", () => {
    expect(
      nextStep({ x: 0, y: 3 }, { x: 0, y: 0 }, new Set(["0,2"]), 1),
    ).toEqual({ x: 1, y: 3 });
    expect(
      nextStep({ x: 0, y: 0 }, { x: 5, y: 5 }, new Set(["0,1", "1,0"]), 1),
    ).toBeNull();
  });
  it("replays exactly with the same seed, includes movement, attacks, spells and deaths", () => {
    const a = player("a", [unit("pyre", "a", 30, 3)]),
      b = player("b", [unit("rivet", "b", 30), unit("brook", "c", 31)]);
    const result = simulate(a, b, 14);
    expect(result).toEqual(simulate(a, b, 14));
    const events = result.frames.flatMap((f) => f.events);
    expect(events.some((e) => e.type === "move")).toBe(true);
    expect(events.some((e) => e.type === "attack")).toBe(true);
    expect(events.some((e) => e.type === "cast")).toBe(true);
    expect(events.some((e) => e.type === "death")).toBe(true);
    expect(result.winner).toBe(0);
    expect(a.units[0].items).toEqual([]);
  });
  it("processes every skill kind including stun, slow, silence, heal, shield and summon", () => {
    const kinds = new Set<string>();
    for (const d of UNITS) {
      const a = player("a", [
          unit(d.id, "a", 12, 2, ["moonwell", "moonwell", "moonwell"]),
          unit("cinder", "ally", 13),
        ]),
        b = player("b", [
          unit("rivet", "b", 12, 3),
          unit("cinder", "c", 13, 3),
        ]);
      const events = simulate(a, b, 91).frames.flatMap((f) => f.events);
      for (const e of events) {
        kinds.add(e.type);
        if (e.type === "status") kinds.add(e.text!);
      }
    }
    for (const k of [
      "stun",
      "slow",
      "silence",
      "heal",
      "shield",
      "summon",
      "cast",
    ])
      expect(kinds.has(k), k).toBe(true);
  });
  it("item stats and synergy effects change combat actor stats", () => {
    const a = player("a", [
      unit("cinder", "a", 0, 1, ["heartglass"]),
      unit("rivet", "b", 1),
    ]);
    const result = simulate(a, player("b", [unit("brook", "x", 0)]), 3);
    const first = result.frames[0].units[0];
    expect(first.maxHp).toBe(1040);
    expect(first.shield).toBe(80);
  });
  it("triggers item passives in combat", () => {
    const a = player("a", [
      unit("rivet", "a", 0, 3, ["bloodopal", "stormpin", "thornseal"]),
      unit("cinder", "c", 1, 1, ["dawnshell", "dewstone", "prismfang"]),
    ]);
    const b = player("b", [unit("pyre", "b", 0, 3), unit("anvil", "d", 1, 3)]);
    const events = simulate(a, b, 125).frames.flatMap((f) => f.events);
    expect(events.some((e) => e.type === "heal")).toBe(true);
    expect(events.some((e) => e.type === "shield" && e.value === 300)).toBe(
      true,
    );
    expect(events.some((e) => e.type === "damage" && e.text === "magic")).toBe(
      true,
    );
    const critEvents = Array.from({ length: 10 }, (_, seed) =>
      simulate(a, b, seed).frames.flatMap((f) => f.events),
    ).flat();
    expect(
      critEvents.some((e) => e.type === "attack" && e.text === "critical"),
    ).toBe(true);
  });
  it("handles an empty battlefield as a draw and returns bounded frames", () => {
    const result = simulate(player("a"), player("b"), 42);
    expect(result.winner).toBeNull();
    expect(result.frames).toHaveLength(1);
    expect(result.duration).toBeGreaterThan(0);
  });
  it("packs eight recruits in a crowded back row without overlap", () => {
    const result = simulate(
      player(
        "a",
        Array.from({ length: 8 }, (_, i) => unit("rivet", String(i), 24 + i)),
      ),
      player("b", [unit("cinder", "b", 30)]),
      1,
    );
    const coords = result.frames[0].units
      .filter((u) => u.side === 0)
      .map((u) => `${u.x},${u.y}`);
    expect(new Set(coords).size).toBe(8);
  });
});
