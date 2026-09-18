import type {
  BattleStatsSnapshot,
  BattleUnitStats,
  CombatEvent,
  Fighter,
} from "./types";
import { UNIT_MAP } from "./content";
export type StatsSort = "damageDealt" | "damageTaken" | "position";
export function sortBattleStats(rows: BattleUnitStats[], sort: StatsSort) {
  return [...rows].sort(
    (a, b) =>
      (sort === "position"
        ? a.originalSlot - b.originalSlot
        : b[sort] - a[sort]) || a.unitId.localeCompare(b.unitId),
  );
}
/** Only authoritative HP loss enters damage counters. Shield and healing are separate. */
export function hpDamage(
  rawAfterResistance: number,
  hp: number,
  shield: number,
) {
  const absorbed = Math.min(
    Math.max(0, shield),
    Math.max(0, rawAfterResistance),
  );
  return {
    absorbed,
    damage: Math.min(
      Math.max(0, hp),
      Math.max(0, rawAfterResistance - absorbed),
    ),
  };
}
export class BattleStatsCollector {
  private rows = new Map<string, BattleUnitStats>();
  private attribution = new Map<string, string>();
  constructor(
    private battleId: string,
    private round: number,
  ) {}
  register(
    f: Fighter,
    ownerId: string,
    originalSlot: number,
    summonOwner?: string,
  ) {
    const owner = summonOwner && this.attribution.get(summonOwner);
    if (owner) {
      this.attribution.set(f.id, owner);
      return;
    }
    this.attribution.set(f.id, f.id);
    this.rows.set(f.id, {
      unitId: f.unitId ?? f.id,
      combatUnitId: f.id,
      ownerId,
      defId: f.defId,
      name: UNIT_MAP[f.defId].name,
      portrait: f.defId,
      star: f.star,
      originalSlot,
      items: [...(f.items ?? [])],
      summoned: !!f.summon,
      damageDealt: 0,
      damageTaken: 0,
      damageAbsorbed: 0,
      healingDone: 0,
      shieldGranted: 0,
      unitsDefeated: 0,
      skillCasts: 0,
    });
  }
  record(event: CombatEvent) {
    const sourceKey = this.attribution.get(event.source),
      targetKey = event.target && this.attribution.get(event.target);
    const source = sourceKey && this.rows.get(sourceKey),
      target = targetKey && this.rows.get(targetKey);
    const value = Math.max(0, event.value ?? 0);
    if (event.type === "damage") {
      if (target) {
        target.damageTaken += value;
        target.damageAbsorbed += Math.max(0, event.absorbed ?? 0);
      }
      if (source && event.source !== event.target) source.damageDealt += value;
      if (source && event.source !== event.target && event.killed)
        source.unitsDefeated++;
    } else if (source) {
      if (event.type === "heal") source.healingDone += value;
      if (event.type === "shield") source.shieldGranted += value;
      if (event.type === "cast") source.skillCasts++;
    }
  }
  snapshot(): BattleStatsSnapshot {
    return {
      version: 1,
      battleId: this.battleId,
      round: this.round,
      units: structuredClone([...this.rows.values()]),
    };
  }
}
