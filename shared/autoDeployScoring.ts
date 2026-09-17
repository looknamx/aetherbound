import { BOARD, UNIT_MAP } from "./content";
import { synergies } from "./economy";
import { permanentStats } from "./stats";
import type { Unit } from "./types";
export const AUTO_DEPLOY_POWER_WEIGHTS = {
  health: 0.1,
  dps: 1,
  armor: 1,
  resist: 1,
};
export function autoDeployScore(unit: Unit, army: Unit[]): number[] {
  const d = UNIT_MAP[unit.defId],
    s = permanentStats(unit),
    w = AUTO_DEPLOY_POWER_WEIGHTS;
  const power =
    s.maxHp * w.health +
    s.attack * s.speed * w.dps +
    s.armor * w.armor +
    s.resist * w.resist;
  const before = synergies(army).reduce((n, t) => n + t.tier, 0);
  const after = synergies([...army, { ...unit, slot: 0 }]).reduce(
    (n, t) => n + t.tier,
    0,
  );
  // Current content encodes rarity 1..5 in cost. Keep distinct tuple entries for future costs.
  return [
    unit.star,
    d.cost,
    d.cost,
    power,
    after - before,
    -(unit.slot - BOARD.benchStart),
  ];
}
export function compareForAutoDeploy(a: Unit, b: Unit, army: Unit[]) {
  const x = autoDeployScore(a, army),
    y = autoDeployScore(b, army);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i];
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
