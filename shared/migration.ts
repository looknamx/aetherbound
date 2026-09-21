import { z } from "zod";
import type { Room } from "./types";
import { initializePool, assertPool } from "./pool";
import { repairFormation } from "./autoDeploy";
import { AUGMENT_MAP, eligibleAugments } from "./strategyConfig";
import { UNIT_MAP, ITEM_MAP } from "./content";
const choice = z
  .object({
    round: z.number().int().positive(),
    options: z.array(z.string()).length(3),
  })
  .strict();
export const strategyPlayerSchema = z.object({
  augments: z.array(z.string().refine((id) => !!AUGMENT_MAP[id])).default([]),
  pendingChoices: z
    .object({ item: choice.optional(), augment: choice.optional() })
    .default({}),
  rewardOverflow: z
    .array(z.string().refine((id) => !!ITEM_MAP[id]))
    .default([]),
  bot: z
    .object({
      difficulty: z.enum(["easy", "normal", "hard"]),
      plannedRound: z.number().int().nonnegative(),
    })
    .optional(),
});
/** Used explicitly at restore boundaries, never while validating a rejected action. */
export function migrateRoom(input: Room): Room {
  const room = structuredClone(input);
  if (room.schemaVersion !== undefined && room.schemaVersion !== 2)
    throw Error("Unsupported state version.");
  for (const p of room.players) {
    for (const u of p.units)
      if (!UNIT_MAP[u.defId] || ![1, 2, 3].includes(u.star))
        throw Error("Invalid stored recruit.");
    for (const id of p.shop)
      if (id !== null && !UNIT_MAP[id]) throw Error("Invalid stored shop.");
    Object.assign(p, strategyPlayerSchema.parse(p));
    repairFormation(p);
    if (new Set(p.augments).size !== p.augments!.length)
      throw Error("Duplicate augment.");
    for (const id of p.augments!)
      if (
        !eligibleAugments(p.augments!.filter((other) => other !== id)).some(
          (a) => a.id === id,
        )
      )
        throw Error("Conflicting augments.");
    for (const [kind, c] of Object.entries(p.pendingChoices!)) {
      if (!c) continue;
      if (
        new Set(c.options).size !== 3 ||
        c.options.some((id) =>
          kind === "item" ? !ITEM_MAP[id] : !AUGMENT_MAP[id],
        )
      )
        throw Error("Invalid stored choices.");
    }
  }
  if (!room.pool) initializePool(room, true);
  else assertPool(room);
  room.schemaVersion = 2;
  room.mode ??= "multiplayer";
  return room;
}
