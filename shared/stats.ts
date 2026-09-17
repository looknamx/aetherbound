import { ITEM_MAP, STAT_MULT, UNIT_MAP } from "./content";
import { synergies } from "./economy";
import type { Unit } from "./types";
export interface UnitStats {
  attack: number;
  maxHp: number;
  armor: number;
  resist: number;
  speed: number;
  range: number;
  mana: number;
  maxMana: number;
  moveSpeed: number;
  shield: number;
  crit: number;
  regen: number;
  spellPower: number;
}
/** DEF is a summary of equal-weight physical/magic defense, not a replacement damage formula. */
export function defenseRating(armor: number, resist: number) {
  return Math.round((armor + resist) / 2);
}
export function permanentStats(
  unit: Pick<Unit, "defId" | "star" | "items">,
): UnitStats {
  const d = UNIT_MAP[unit.defId],
    m = STAT_MULT[unit.star];
  const result: UnitStats = {
    attack: d.attack * m,
    maxHp: d.hp * m,
    armor: d.armor,
    resist: d.resist,
    speed: d.speed,
    range: d.range,
    mana: d.mana,
    maxMana: d.maxMana,
    moveSpeed: d.moveSpeed,
    shield: 0,
    crit: 0.1,
    regen: 0,
    spellPower: 1,
  };
  for (const id of unit.items) {
    const item = ITEM_MAP[id];
    if (!item) continue;
    if (item.stat === "hp") result.maxHp += item.amount;
    else if (item.stat === "speed") result.speed *= 1 + item.amount;
    else if (item.stat) result[item.stat] += item.amount;
    if (item.passive === "regen") result.regen += item.amount;
    if (item.passive === "crit") result.crit += item.amount;
  }
  return result;
}
/** The simulator and formation previews call this exact calculation. */
export function battleStats(
  unit: Pick<Unit, "defId" | "star" | "items">,
  army: Unit[],
): UnitStats {
  const stats = permanentStats(unit),
    traits = Object.fromEntries(synergies(army).map((t) => [t.id, t.tier]));
  stats.attack += traits.Emberkin * 10;
  stats.maxHp += traits.Verdant * 100;
  stats.armor += traits.Ironveil * 12;
  stats.resist += traits.Tideborn * 10;
  stats.mana += traits.Astral * 15;
  stats.shield += traits.Warden * 80;
  stats.speed *= 1 + traits.Striker * 0.15;
  stats.crit += traits.Ranger * 0.1;
  stats.regen += traits.Weaver * 8;
  stats.spellPower += traits.Arcanist * 0.2;
  return stats;
}
