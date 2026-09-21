import { synergies } from "../shared/economy";
import { isDeploymentSlot } from "../shared/deploymentZone";
import type { Room, Player, Snapshot } from "../shared/types";
import type { ScoutingView } from "../shared/strategyTypes";
import { z } from "zod";
export const scoutingSchema = z
  .object({
    seat: z.number().int().nonnegative(),
    name: z.string(),
    hp: z.number().nonnegative(),
    level: z.number().int().positive(),
    connected: z.boolean(),
    eliminated: z.boolean(),
    units: z.array(
      z
        .object({
          defId: z.string(),
          star: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          slot: z.number().int().min(18).max(35),
          items: z.array(z.string()),
        })
        .strict(),
    ),
    traits: z.array(
      z
        .object({
          name: z.string(),
          count: z.number().int().nonnegative(),
          tier: z.number().int().nonnegative(),
          next: z.number().optional(),
          needed: z.number().nonnegative(),
        })
        .strict(),
    ),
    augments: z.array(z.string()),
  })
  .strict();
export function scoutingView(p: Player, seat: number): ScoutingView {
  return scoutingSchema.parse({
    seat,
    name: p.name,
    hp: p.hp,
    level: p.level,
    connected: p.connected,
    eliminated: p.hp <= 0,
    units: p.units
      .filter((u) => isDeploymentSlot(u.slot))
      .map((u) => ({
        defId: u.defId,
        star: u.star,
        slot: u.slot,
        items: [...u.items],
      })),
    traits: synergies(p.units)
      .filter((t) => t.count > 0)
      .map((t) => {
        const next = t.thresholds.find((n) => n > t.count);
        return {
          name: t.id,
          count: t.count,
          tier: t.tier,
          next,
          needed: next === undefined ? 0 : next - t.count,
        };
      }),
    augments: [...(p.augments ?? [])],
  });
}
/** Explicit public fields: no private choices, benches, economy or RNG. */
export function publicPlayer(p: Player): Player {
  return {
    id: p.id,
    name: p.name,
    connected: p.connected,
    ready: p.ready,
    hp: p.hp,
    level: p.level,
    rank: p.rank,
    gold: 0,
    xp: 0,
    shop: [],
    locked: false,
    inventory: [],
    streak: 0,
    units: p.units
      .filter((u) => isDeploymentSlot(u.slot))
      .map((u) => ({
        id: u.id,
        defId: u.defId,
        star: u.star,
        slot: u.slot,
        items: [...u.items],
      })),
    augments: [...(p.augments ?? [])],
  };
}
export function roomView(room: Room, you: string): Snapshot["room"] {
  const own = room.players.find((p) => p.id === you)!;
  return {
    key: room.key,
    hostId: room.hostId,
    phase: room.phase,
    round: room.round,
    deadline: room.deadline,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    revision: room.revision,
    schemaVersion: 2,
    mode: room.mode,
    players: room.players.map((p) =>
      p.id === you ? structuredClone(p) : publicPlayer(p),
    ),
    battles: room.battles
      .filter((b) => b.a === you || b.b === you || own.hp === 0)
      .map((b) => {
        const { seed: _seed, ...safe } = b;
        return safe;
      }),
    deployments: room.deployments?.filter((d) => d.playerId === you),
  };
}
