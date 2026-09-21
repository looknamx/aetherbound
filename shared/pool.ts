import { ODDS, UNITS } from "./content";
import { RNG } from "./random";
import { augmentValue, STRATEGY } from "./strategyConfig";
import type { Player, Room, Unit } from "./types";
export const copies = (u: Unit) => (u.summoned ? 0 : 3 ** (u.star - 1));
export function initializePool(room: Room, legacy = false) {
  const total: Record<string, number> = {},
    available: Record<string, number> = {};
  for (const def of UNITS) {
    const held = room.players.reduce(
      (n, p) =>
        n +
        p.shop.filter((id) => id === def.id).length +
        p.units
          .filter((u) => u.defId === def.id)
          .reduce((n, u) => n + copies(u), 0),
      0,
    );
    total[def.id] = legacy
      ? Math.max(STRATEGY.poolCopies[def.cost - 1], held)
      : STRATEGY.poolCopies[def.cost - 1];
    available[def.id] = total[def.id] - held;
    if (available[def.id] < 0) throw Error("Unit supply exceeded.");
  }
  room.pool = { version: 1, total, available };
}
export function assertPool(room: Room) {
  if (!room.pool) return;
  for (const def of UNITS) {
    const held = room.players.reduce(
      (n, p) =>
        n +
        p.shop.filter((id) => id === def.id).length +
        p.units
          .filter((u) => u.defId === def.id)
          .reduce((n, u) => n + copies(u), 0),
      0,
    );
    const available = room.pool.available[def.id];
    if (
      !Number.isInteger(available) ||
      available < 0 ||
      available + held !== room.pool.total[def.id]
    )
      throw Error(`Pool invariant violated: ${def.id}`);
  }
}
export function releaseShop(room: Room, p: Player) {
  if (room.pool) for (const id of p.shop) if (id) room.pool.available[id]++;
  p.shop = Array(5).fill(null);
}
export function reserve(room: Room, defId: string, count = 1) {
  if (
    !room.pool ||
    !Number.isInteger(count) ||
    count < 1 ||
    (room.pool.available[defId] ?? 0) < count
  )
    throw Error("No copies available.");
  room.pool.available[defId] -= count;
}
export function returnUnit(room: Room, u: Unit) {
  if (room.pool) room.pool.available[u.defId] += copies(u);
}
export function shopOdds(p: Pick<Player, "level" | "augments">) {
  const weights = [...ODDS[p.level - 1]];
  weights[2] *= augmentValue(p.augments, "rareShop") || 1;
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((n) => (n / total) * 100);
}
export function pooledShop(room: Room, p: Player, rng: RNG) {
  if (!room.pool) initializePool(room, true);
  releaseShop(room, p);
  p.shop = Array.from({ length: 5 }, () => {
    let roll = rng.next() * 100,
      tier = 0;
    const odds = shopOdds(p);
    while (tier < 4 && roll >= odds[tier]) roll -= odds[tier++];
    // If the sampled rarity is exhausted, visit each remaining tier once, nearest first.
    const tiers = [0, 1, 2, 3, 4].sort(
      (a, b) => Math.abs(a - tier) - Math.abs(b - tier) || a - b,
    );
    for (const candidate of tiers) {
      const defs = UNITS.filter(
        (d) => d.cost === candidate + 1 && room.pool!.available[d.id] > 0,
      );
      const sum = defs.reduce((n, d) => n + room.pool!.available[d.id], 0);
      if (!sum) continue;
      let pick = rng.next() * sum;
      const def =
        defs.find((d) => (pick -= room.pool!.available[d.id]) < 0) ??
        defs.at(-1)!;
      reserve(room, def.id);
      return def.id;
    }
    return null;
  });
}
export function eliminateSupply(room: Room, p: Player) {
  releaseShop(room, p);
  for (const u of p.units) returnUnit(room, u);
  p.units = [];
  p.pendingChoices = {};
}
