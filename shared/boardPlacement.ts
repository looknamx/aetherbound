import { BOARD, ROLE_CONFIG, UNIT_MAP } from "./content";
import type { Player, Unit } from "./types";
import { isDeploymentSlot } from "./deploymentZone";
export const isFieldSlot = (slot: number) =>
  Number.isInteger(slot) && slot >= 0 && slot < BOARD.cells;
export const isLegalFieldSlot = (
  slot: number,
  blocked: readonly number[] = [],
) => isDeploymentSlot(slot) && !blocked.includes(slot);
export function deploymentLimit(player: Pick<Player, "level">) {
  return Number.isFinite(player.level)
    ? Math.max(0, Math.min(8, Math.floor(player.level)))
    : 0;
}
export function chooseAutoDeploySlot(
  unit: Unit,
  occupied: ReadonlySet<number>,
  blocked: readonly number[] = [],
): number | undefined {
  const preference = ROLE_CONFIG[UNIT_MAP[unit.defId].role];
  // Ordered row preference, then center or flank preference; all legal fallbacks are explicit in config.
  for (const row of preference.rows)
    for (const col of preference.columns) {
      const slot = row * BOARD.size + col;
      if (isLegalFieldSlot(slot, blocked) && !occupied.has(slot)) return slot;
    }
  return undefined;
}
