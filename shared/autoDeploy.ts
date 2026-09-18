import { BOARD } from "./content";
import { mergeUnits } from "./economy";
import { compareForAutoDeploy } from "./autoDeployScoring";
import {
  chooseAutoDeploySlot,
  deploymentLimit,
  isFieldSlot,
  isLegalFieldSlot,
} from "./boardPlacement";
import type { DeployMove, Player, Unit } from "./types";
export interface DeploymentResult {
  moves: DeployMove[];
  repaired: number;
}
/** Moves legacy invalid/excess field entries into reserves without selling units or losing relics.
 * If the usual eight reserves are full, recovery-only slots >=44 preserve ownership. */
export function repairFormation(player: Player) {
  let repaired = 0;
  const occupied = new Set<number>();
  const limit = deploymentLimit(player);
  const onField = player.units
    .filter((u) => isFieldSlot(u.slot))
    .sort((a, b) => compareForAutoDeploy(a, b, player.units));
  const retain = new Set(
    onField
      .filter((u) => isLegalFieldSlot(u.slot, player.blockedSlots))
      .slice(0, limit)
      .map((u) => u.id),
  );
  const displaced: Unit[] = [];
  for (const unit of [...player.units].sort(
    (a, b) => a.slot - b.slot || a.id.localeCompare(b.id),
  )) {
    const validField =
      isFieldSlot(unit.slot) &&
      retain.has(unit.id) &&
      isLegalFieldSlot(unit.slot, player.blockedSlots);
    const validReserve =
      Number.isInteger(unit.slot) && unit.slot >= BOARD.benchStart;
    if ((validField || validReserve) && !occupied.has(unit.slot)) {
      occupied.add(unit.slot);
      continue;
    }
    displaced.push(unit);
  }
  for (const unit of displaced) {
    let slot = BOARD.benchStart;
    while (occupied.has(slot)) slot++;
    unit.slot = slot;
    occupied.add(slot);
    repaired++;
  }
  return repaired;
}
export function validateFormation(player: Player) {
  const occupied = new Set<number>();
  let count = 0;
  for (const unit of player.units) {
    if (unit.summoned) throw Error("Summons cannot be permanent recruits.");
    if (
      !Number.isInteger(unit.slot) ||
      unit.slot < 0 ||
      occupied.has(unit.slot)
    )
      throw Error("Invalid or overlapping formation slot.");
    occupied.add(unit.slot);
    if (isFieldSlot(unit.slot)) {
      if (!isLegalFieldSlot(unit.slot, player.blockedSlots))
        throw Error("Blocked field slot.");
      count++;
    }
  }
  if (count > deploymentLimit(player))
    throw Error("Formation exceeds unit limit.");
}
/** Authoritative transition service. No randomness, network calls, timers, UI or new unit creation. */
export function autoDeploy(player: Player): DeploymentResult {
  player.units = player.units.filter((u) => !u.summoned);
  mergeUnits(player);
  const repaired = repairFormation(player),
    moves: DeployMove[] = [];
  const occupied = new Set(
    player.units.filter((u) => isFieldSlot(u.slot)).map((u) => u.slot),
  );
  while (occupied.size < deploymentLimit(player)) {
    const candidate = player.units
      .filter((u) => u.slot >= BOARD.benchStart)
      .sort((a, b) => compareForAutoDeploy(a, b, player.units))[0];
    if (!candidate) break;
    const slot = chooseAutoDeploySlot(candidate, occupied, player.blockedSlots);
    if (slot === undefined) break;
    moves.push({
      unitId: candidate.id,
      defId: candidate.defId,
      star: candidate.star,
      items: [...candidate.items],
      fromSlot: candidate.slot,
      toSlot: slot,
    });
    candidate.slot = slot;
    occupied.add(slot);
  }
  validateFormation(player);
  return { moves, repaired };
}
/** Read-only server-side recommendation for bench highlights; never commits a deployment. */
export function previewAutoDeploy(player: Player) {
  return autoDeploy(structuredClone(player)).moves.map((m) => m.unitId);
}
