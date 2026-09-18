import { BOARD } from "./content";
export const DEPLOYMENT_START_ROW = BOARD.size / 2;
export const PLACEMENT_MESSAGE =
  "สามารถวางการ์ดได้เฉพาะพื้นที่ 3 แถวฝั่งของคุณ";
export class PlacementError extends Error {
  readonly code = "INVALID_PLACEMENT_ZONE";
  constructor() {
    super(PLACEMENT_MESSAGE);
  }
}
export interface BoardPoint {
  x: number;
  y: number;
}
export function isDeploymentSlot(slot: number) {
  return (
    Number.isInteger(slot) &&
    slot >= DEPLOYMENT_START_ROW * BOARD.size &&
    slot < BOARD.cells
  );
}
/** Both mappings are involutions. Formation slots are always owner-relative. */
export function canonicalToRelative(
  point: BoardPoint,
  side: 0 | 1,
): BoardPoint {
  return side === 0
    ? { ...point }
    : { x: BOARD.size - 1 - point.x, y: BOARD.size - 1 - point.y };
}
export const relativeToCanonical = canonicalToRelative;
export function slotToPoint(slot: number): BoardPoint {
  return { x: slot % BOARD.size, y: Math.floor(slot / BOARD.size) };
}
