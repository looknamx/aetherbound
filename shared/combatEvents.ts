import { z } from "zod";
import { UNIT_MAP } from "./content";
import type { CombatEvent, CombatFrame } from "./types";
export const EVENT_KIND = {
  move: "Move",
  attack: "AttackStarted",
  damage: "DamageApplied",
  cast: "SkillCastStarted",
  death: "UnitDied",
  heal: "HealApplied",
  shield: "ShieldGranted",
  status: "DebuffApplied",
  summon: "UnitSummoned",
  shieldDamage: "ShieldDamaged",
  shieldBreak: "ShieldBroken",
  castResolved: "SkillCastResolved",
  target: "TargetChanged",
  battleEnd: "BattleEnded",
  critical: "CriticalHit",
} as const;
export const structuredEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  tick: z.number().int().nonnegative(),
  kind: z.enum(Object.values(EVENT_KIND) as [string, ...string[]]),
  source: z.string(),
  target: z.string().optional(),
  value: z.number().finite().nonnegative().optional(),
  damageType: z.enum(["physical", "magic", "true"]).optional(),
  effectId: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  owner: z.union([z.literal(0), z.literal(1)]).optional(),
});
/** Cursor ignores duplicate/late delivery; reconnect starts at the current authoritative tick. */
export class EventCursor {
  private battle = "";
  private sequence = -1;
  reset(battle: string, sequence = -1) {
    this.battle = battle;
    this.sequence = sequence;
  }
  consume(battle: string, events: CombatEvent[]) {
    if (this.battle !== battle) this.reset(battle);
    const fresh = [...events]
      .sort((a, b) => (a.sequence ?? -1) - (b.sequence ?? -1))
      .filter((e) => (e.sequence ?? -1) > this.sequence);
    const seen = new Set<number>();
    const result = fresh.filter((e) => {
      if (seen.has(e.sequence!)) return false;
      seen.add(e.sequence!);
      return true;
    });
    if (result.length) this.sequence = result.at(-1)!.sequence!;
    return result;
  }
}
export function eventLabel(
  event: CombatEvent,
  frame: CombatFrame,
  locale: "th" | "en" = "th",
) {
  const source = frame.units.find((u) => u.id === event.source),
    target = frame.units.find((u) => u.id === event.target);
  const name = source ? UNIT_MAP[source.defId]?.name : undefined,
    targetName = target ? UNIT_MAP[target.defId]?.name : undefined;
  const amount = Number.isFinite(event.value)
    ? event.value!.toLocaleString(locale === "th" ? "th-TH" : "en-US", {
        maximumFractionDigits: 1,
      })
    : "";
  const th = locale === "th";
  if (event.kind === "BattleEnded") return th ? "จบการต่อสู้" : "Battle ended";
  if (!name) return undefined;
  if (event.type === "cast")
    return `${name} ${th ? "ใช้สกิล" : "casts"} ${UNIT_MAP[source!.defId].skill.name}`;
  if (event.type === "death")
    return `${name} ${th ? "ถูกกำจัด" : "defeated"}${targetName ? ` · ${th ? "โดย" : "by"} ${targetName}` : ""}`;
  if (event.type === "shieldBreak")
    return `${name} · ${th ? "โล่แตก" : "shield broken"}`;
  if (event.type === "shieldDamage")
    return `${name} → ${targetName ?? ""} · ${th ? "โล่ดูดซับ" : "shield absorbed"} ${amount}`;
  if (event.type === "damage" && (event.value ?? 0) > 0)
    return `${name} → ${targetName ?? ""} · ${event.damageType === "magic" ? (th ? "เวทมนตร์" : "magic") : event.damageType === "true" ? (th ? "โดยตรง" : "true") : th ? "กายภาพ" : "physical"} −${amount}`;
  if (event.type === "heal")
    return `${name} → ${targetName ?? name} · ${th ? "ฟื้นฟู" : "heal"} +${amount}`;
  return undefined;
}
