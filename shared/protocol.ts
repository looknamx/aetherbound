import { z } from "zod";
const unitId = z.string().min(1).max(80);
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), ready: z.boolean() }).strict(),
  z.object({ type: z.literal("start") }).strict(),
  z
    .object({ type: z.literal("buy"), index: z.number().int().min(0).max(4) })
    .strict(),
  z.object({ type: z.literal("sell"), unitId }).strict(),
  z
    .object({
      type: z.literal("move"),
      unitId,
      slot: z.number().int().min(0).max(43),
    })
    .strict(),
  ...(["reroll", "lock", "xp"] as const).map((type) =>
    z.object({ type: z.literal(type) }).strict(),
  ),
  z
    .object({
      type: z.literal("equip"),
      unitId,
      itemIndex: z.number().int().min(0).max(99),
    })
    .strict(),
  z
    .object({
      type: z.literal("unequip"),
      unitId,
      itemIndex: z.number().int().min(0).max(2),
    })
    .strict(),
  z
    .object({
      type: z.literal("dev"),
      command: z.enum([
        "gold",
        "level",
        "seed",
        "shop",
        "unit",
        "item",
        "advance",
        "speed",
      ]),
      value: z.string().max(100).optional(),
    })
    .strict(),
]);
export const envelopeSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(8).max(80),
    action: actionSchema,
  })
  .strict();
export const enterSchema = z
  .object({
    name: z.string().trim().min(1).max(24),
    key: z
      .string()
      .regex(/^[A-Z2-9]{6}$/)
      .optional(),
  })
  .strict();
