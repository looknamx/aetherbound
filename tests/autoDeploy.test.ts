import { describe, expect, it } from "vitest";
import {
  autoDeploy,
  previewAutoDeploy,
  validateFormation,
} from "../shared/autoDeploy";
import { compareForAutoDeploy } from "../shared/autoDeployScoring";
import { chooseAutoDeploySlot } from "../shared/boardPlacement";
import { GameEngine } from "../server/engine";
import { player, unit } from "./helpers";
const fieldCount = (p: ReturnType<typeof player>) =>
  p.units.filter((u) => u.slot < 36).length;
describe("server auto-deployment", () => {
  it("fills 2/4 to 4/4 from a five-card bench, preserving existing positions", () => {
    const p = player("p", [
      unit("cinder", "a", 18),
      unit("brook", "b", 30),
      ...["lumen", "rivet", "thorn", "flare", "nova"].map((d, i) =>
        unit(d, `r${i}`, 36 + i),
      ),
    ]);
    p.level = 4;
    expect(autoDeploy(p).moves).toHaveLength(2);
    expect(fieldCount(p)).toBe(4);
    expect(p.units.find((u) => u.id === "a")!.slot).toBe(18);
    expect(p.units.find((u) => u.id === "b")!.slot).toBe(30);
  });
  it("fills 2/4 to 3/4 with only one reserve", () => {
    const p = player("p", [
      unit("cinder", "a", 18),
      unit("brook", "b", 30),
      unit("lumen", "c", 36),
    ]);
    p.level = 4;
    autoDeploy(p);
    expect(fieldCount(p)).toBe(3);
  });
  it("does nothing to a full board or empty bench", () => {
    const p = player("p", [
      unit("cinder", "a", 18),
      unit("brook", "b", 30),
      unit("lumen", "c", 36),
    ]);
    const before = structuredClone(p);
    expect(autoDeploy(p).moves).toEqual([]);
    expect(p).toEqual(before);
    expect(autoDeploy(player()).moves).toEqual([]);
  });
  it("zero limit returns old field units to reserves", () => {
    const p = player("p", [unit("cinder", "a", 18), unit("brook", "b", 36)]);
    p.level = 0;
    autoDeploy(p);
    expect(fieldCount(p)).toBe(0);
    expect(p.units).toHaveLength(2);
    expect(() => validateFormation(p)).not.toThrow();
  });
  it("prioritizes star above rarity, and rarity/cost above power", () => {
    const p = player("p", [
      unit("cinder", "a", 36, 2),
      unit("solara", "b", 37),
      unit("pyre", "c", 38),
    ]);
    p.level = 1;
    expect(autoDeploy(p).moves[0].unitId).toBe("a");
    const q = player("q", [
      unit("cinder", "a", 36),
      unit("solara", "b", 37),
      unit("pyre", "c", 38),
    ]);
    q.level = 1;
    expect(autoDeploy(q).moves[0].unitId).toBe("b");
  });
  it("uses permanent item stats for the power tie-breaker", () => {
    const p = player("p", [
      unit("cinder", "a", 36),
      unit("cinder", "b", 37, 1, ["sunshard"]),
    ]);
    p.level = 1;
    expect(autoDeploy(p).moves[0].unitId).toBe("b");
  });
  it("resolves equal scores left-to-right independent of array order", () => {
    const a = unit("cinder", "a", 39),
      b = unit("cinder", "b", 36);
    expect(compareForAutoDeploy(a, b, [])).toBeGreaterThan(0);
    for (const list of [
      [a, b],
      [b, a],
    ]) {
      const p = player("p", structuredClone(list));
      p.level = 1;
      expect(autoDeploy(p).moves[0].unitId).toBe("b");
    }
  });
  it("places tanks front, rangers/mages back, assassins at a flank, summoners middle", () => {
    expect(chooseAutoDeploySlot(unit("cinder"), new Set())).toBe(20);
    expect(chooseAutoDeploySlot(unit("lumen"), new Set())).toBe(32);
    expect(chooseAutoDeploySlot(unit("nova"), new Set())).toBe(32);
    expect(chooseAutoDeploySlot(unit("thorn"), new Set())).toBe(18);
    expect(chooseAutoDeploySlot(unit("moss"), new Set())).toBe(26);
  });
  it("avoids occupied/blocked tiles and stops when no legal tile remains", () => {
    const p = player("p", [unit("cinder", "a", 36), unit("rivet", "b", 37)]);
    p.blockedSlots = [18, 19, 20, 21, 22, 23];
    autoDeploy(p);
    expect(p.units.every((u) => u.slot >= 24 && u.slot < 36)).toBe(true);
    expect(new Set(p.units.map((u) => u.slot)).size).toBe(2);
    const q = player("q", [unit("cinder", "a", 36)]);
    q.blockedSlots = Array.from({ length: 36 }, (_, i) => i);
    expect(autoDeploy(q).moves).toEqual([]);
    expect(q.units[0].slot).toBe(36);
  });
  it("preserves identity, stars, relics and permanent metadata", () => {
    const owned = {
      ...unit("rivet", "original", 36, 2, ["sunshard", "ironleaf"]),
      cosmetic: "bronze",
    };
    const p = player("p", [owned]);
    autoDeploy(p);
    expect(p.units[0]).toBe(owned);
    expect(p.units[0]).toMatchObject({
      id: "original",
      star: 2,
      items: ["sunshard", "ironleaf"],
      cosmetic: "bronze",
    });
  });
  it("merges pending triples before deployment and returns overflow relics", () => {
    const p = player("p", [
      unit("cinder", "a", 36, 1, ["sunshard", "ironleaf"]),
      unit("cinder", "b", 37, 1, ["moonwell"]),
      unit("cinder", "c", 38, 1, ["dawnshell"]),
      unit("solara", "d", 39),
    ]);
    p.level = 1;
    expect(autoDeploy(p).moves[0]).toMatchObject({ unitId: "a", star: 2 });
    expect(p.inventory).toContain("dawnshell");
    expect(fieldCount(p)).toBe(1);
  });
  it("excludes transient summons from permanent formation", () => {
    const p = player("p", [
      { ...unit("solara", "echo", 36, 3), summoned: true },
      unit("cinder", "a", 37),
    ]);
    autoDeploy(p);
    expect(p.units).toHaveLength(1);
    expect(p.units[0].id).toBe("a");
    expect(fieldCount(p)).toBe(1);
  });
  it("repairs legacy excess/overlap without losing owned cards even with a full bench", () => {
    const p = player("p", [
      unit("cinder", "a", 0, 2),
      unit("brook", "b", 0),
      unit("lumen", "c", 1),
      ...Array.from({ length: 8 }, (_, i) =>
        unit(
          ["rivet", "lumen", "brook", "flare", "moss", "nova", "pyre", "anvil"][
            i
          ],
          `r${i}`,
          36 + i,
          3,
        ),
      ),
    ]);
    p.level = 1;
    const ids = p.units.map((u) => u.id).sort();
    expect(autoDeploy(p).repaired).toBeGreaterThan(0);
    expect(p.units.map((u) => u.id).sort()).toEqual(ids);
    expect(fieldCount(p)).toBe(1);
    expect(new Set(p.units.map((u) => u.slot)).size).toBe(p.units.length);
    expect(p.units.some((u) => u.slot >= 44)).toBe(true);
  });
  it("preview is read-only; deployment is idempotent", () => {
    const p = player("p", [unit("rivet", "a", 36), unit("lumen", "b", 37)]),
      before = structuredClone(p);
    const picks = previewAutoDeploy(p);
    expect(p).toEqual(before);
    expect(autoDeploy(p).moves.map((m) => m.unitId)).toEqual(picks);
    expect(autoDeploy(p).moves).toEqual([]);
  });
  it("locks late actions, respects accepted XP, deploys disconnected seats, and snapshots once", () => {
    const e = new GameEngine(),
      a = e.create("A"),
      b = e.join(a.key, "B"),
      r = e.rooms.get(a.key)!;
    e.prepare(r);
    const p = r.players[0];
    p.units = [
      unit("cinder", "one", 36),
      unit("lumen", "two", 37),
      unit("brook", "three", 38),
    ];
    p.gold = 20;
    e.action(a, "last-xp", { type: "xp" });
    expect(p.level).toBe(3);
    e.disconnect(a);
    r.deadline = Date.now() - 1;
    expect(() =>
      e.action(b, "late-move", { type: "move", unitId: "one", slot: 5 }),
    ).toThrow("preparation");
    e.battle(r);
    expect(fieldCount(p)).toBe(3);
    expect(r.deployments![0].moves).toHaveLength(3);
    const board = structuredClone(p.units),
      battle = structuredClone(r.battles);
    e.battle(r);
    expect(p.units).toEqual(board);
    expect(r.battles).toEqual(battle);
    expect(
      r.battles[0].frames[0].units.filter((u) => u.side === 1),
    ).toHaveLength(3);
    expect(e.reconnect(a.token).playerId).toBe(a.playerId);
    expect(p.units).toEqual(board);
  });
});
