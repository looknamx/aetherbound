import { describe, expect, it } from "vitest";
import {
  canonicalToRelative,
  isDeploymentSlot,
  relativeToCanonical,
  slotToPoint,
} from "../shared/deploymentZone";
import { move } from "../shared/economy";
import {
  autoDeploy,
  repairFormation,
  validateFormation,
} from "../shared/autoDeploy";
import { nextStep, simulate } from "../shared/combat";
import { GameEngine } from "../server/engine";
import { player, unit } from "./helpers";
describe("6 by 3 deployment zone", () => {
  it.each(Array.from({ length: 18 }, (_, i) => i + 18))(
    "accepts owned slot %i",
    (slot) => {
      const p = player("p", [unit("cinder", "a", 36)]);
      move(p, "a", slot);
      expect(p.units[0].slot).toBe(slot);
    },
  );
  it.each(Array.from({ length: 18 }, (_, i) => i))(
    "rejects enemy slot %i without changing state",
    (slot) => {
      for (const source of [18, 36]) {
        const p = player("p", [
            unit("cinder", "a", source),
            unit("rivet", "enemy", slot),
          ]),
          before = structuredClone(p);
        expect(() => move(p, "a", slot)).toThrow(
          expect.objectContaining({ code: "INVALID_PLACEMENT_ZONE" }),
        );
        expect(p).toEqual(before);
      }
    },
  );
  it("rejects a swap that would send the occupant to an invalid source", () => {
    const p = player("p", [
        unit("cinder", "legacy", 0),
        unit("rivet", "valid", 18),
      ]),
      before = structuredClone(p);
    expect(() => move(p, "legacy", 18)).toThrow();
    expect(p).toEqual(before);
  });
  it("maps every cell round-trip and puts each owner's units at the bottom", () => {
    for (let slot = 0; slot < 36; slot++)
      for (const side of [0, 1] as const) {
        const pos = slotToPoint(slot);
        expect(
          canonicalToRelative(relativeToCanonical(pos, side), side),
        ).toEqual(pos);
      }
    const battle = simulate(
      player("p", [unit("cinder", "a", 18)]),
      player("q", [unit("rivet", "b", 35)]),
      3,
    );
    for (const f of battle.frames[0].units)
      expect(canonicalToRelative(f, f.side).y).toBeGreaterThanOrEqual(3);
    expect(battle.frames[0].units.map((u) => [u.x, u.y])).toEqual([
      [0, 3],
      [0, 0],
    ]);
  });
  it("auto-deploy is deterministic, unique, legal, and handles no available space", () => {
    const p = player("p", [unit("cinder", "a", 36), unit("lumen", "b", 37)]),
      q = structuredClone(p);
    expect(autoDeploy(p)).toEqual(autoDeploy(q));
    expect(p.units.every((u) => isDeploymentSlot(u.slot))).toBe(true);
    expect(new Set(p.units.map((u) => u.slot)).size).toBe(2);
    q.units = [unit("rivet", "c", 36)];
    q.blockedSlots = Array.from({ length: 18 }, (_, i) => i + 18);
    expect(autoDeploy(q).moves).toEqual([]);
  });
  it("pathfinding and actual battles can cross the middle", () => {
    expect(nextStep({ x: 2, y: 3 }, { x: 2, y: 0 }, new Set(), 1)).toEqual({
      x: 2,
      y: 2,
    });
    const b = simulate(
      player("p", [unit("cinder", "a", 35)]),
      player("q", [unit("rivet", "b", 35)]),
      1,
    );
    expect(
      b.frames.some((f) =>
        f.units.some((u) => (u.side === 0 ? u.y < 3 : u.y >= 3)),
      ),
    ).toBe(true);
  });
  it("repairs legacy positions without losing cards/items and reconnect repeats safely", () => {
    const e = new GameEngine(),
      s = e.create("A"),
      r = e.rooms.get(s.key)!,
      p = r.players[0];
    p.units = [
      unit("cinder", "a", 0, 2, ["sunshard"]),
      ...Array.from({ length: 8 }, (_, i) => unit("rivet", `b${i}`, 36 + i)),
    ];
    e.reconnect(s.token);
    expect(p.units[0]).toMatchObject({
      id: "a",
      star: 2,
      items: ["sunshard"],
      slot: 44,
    });
    const before = structuredClone(p.units);
    e.reconnect(s.token);
    expect(p.units).toEqual(before);
    expect(() => validateFormation(p)).not.toThrow();
    expect(repairFormation(p)).toBe(0);
  });
  it("engine rejected actions do not change room, revisions, seed or replay IDs", () => {
    const e = new GameEngine(),
      s = e.create("A");
    e.join(s.key, "B");
    const r = e.rooms.get(s.key)!;
    e.prepare(r);
    r.players[0].units = [unit("cinder", "a", 36)];
    const before = structuredClone(r);
    for (let i = 0; i < 2; i++)
      expect(() =>
        e.action(s, "invalid", { type: "move", unitId: "a", slot: 0 }),
      ).toThrow();
    expect(r).toEqual(before);
    expect(s.seen.has("invalid")).toBe(false);
    e.action(s, "valid", { type: "move", unitId: "a", slot: 18 });
    const accepted = structuredClone(r);
    e.action(s, "valid", { type: "move", unitId: "a", slot: 0 });
    expect(r).toEqual(accepted);
  });
});
