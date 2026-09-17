import type { Player, Unit } from "../shared/types";
export function player(id = "p1", units: Unit[] = []): Player {
  return {
    id,
    name: id,
    connected: true,
    ready: false,
    hp: 100,
    gold: 50,
    level: 2,
    xp: 0,
    shop: ["cinder", "cinder", "cinder", "brook", "rivet"],
    locked: false,
    units,
    inventory: [],
    streak: 0,
  };
}
export const unit = (
  defId = "cinder",
  id = "u1",
  slot = 30,
  star: 1 | 2 | 3 = 1,
  items: string[] = [],
): Unit => ({ id, defId, slot, star, items });
