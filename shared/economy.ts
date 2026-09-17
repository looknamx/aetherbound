import {
  ITEM_MAP,
  ODDS,
  RULES,
  TRAITS,
  UNIT_MAP,
  UNITS,
  XP_TO_LEVEL,
} from "./content";
import { RNG } from "./random";
import type { Player, Unit } from "./types";
export function rollShop(level: number, rng: RNG): (string | null)[] {
  return Array.from({ length: 5 }, () => {
    let roll = rng.next() * 100;
    let tier = 0;
    while (tier < 4 && roll >= ODDS[level - 1][tier]) {
      roll -= ODDS[level - 1][tier++];
    }
    return rng.pick(UNITS.filter((u) => u.cost === tier + 1)).id;
  });
}
export function synergies(units: Unit[]) {
  const unique = [
    ...new Set(units.filter((u) => u.slot < 36).map((u) => u.defId)),
  ].map((id) => UNIT_MAP[id]);
  return TRAITS.map((t) => {
    const count = unique.filter(
      (u) => u.origin === t.id || u.class === t.id,
    ).length;
    return { ...t, count, tier: t.thresholds.filter((n) => count >= n).length };
  });
}
export function mergeUnits(p: Player) {
  for (let star = 1; star < 3; star++) {
    for (const def of UNITS) {
      let copies = p.units.filter((u) => u.defId === def.id && u.star === star);
      while (copies.length >= 3) {
        const group = copies.slice(0, 3).sort((a, b) => a.slot - b.slot);
        const keep = group[0];
        keep.star = (star + 1) as 2 | 3;
        const items = group.flatMap((u) => u.items);
        keep.items = items.slice(0, 3);
        p.inventory.push(...items.slice(3));
        p.units = p.units.filter(
          (u) => u.id === keep.id || !group.some((g) => g.id === u.id),
        );
        copies = p.units.filter((u) => u.defId === def.id && u.star === star);
      }
    }
  }
}
export function buy(p: Player, index: number, id: string) {
  const defId = p.shop[index];
  if (!defId) throw Error("This shop slot is empty.");
  const def = UNIT_MAP[defId];
  if (p.gold < def.cost) throw Error("Not enough gold.");
  const slot = Array.from({ length: 8 }, (_, i) => 36 + i).find(
    (s) => !p.units.some((u) => u.slot === s),
  );
  const willMerge =
    p.units.filter((u) => u.defId === defId && u.star === 1).length >= 2;
  if (slot === undefined && !willMerge) throw Error("Your bench is full.");
  p.gold -= def.cost;
  p.shop[index] = null;
  p.units.push({ id, defId, star: 1, slot: slot ?? 44, items: [] });
  mergeUnits(p);
}
export function sell(p: Player, id: string) {
  const u = p.units.find((u) => u.id === id);
  if (!u) throw Error("Unit not found.");
  p.gold += UNIT_MAP[u.defId].cost * 3 ** (u.star - 1);
  p.inventory.push(...u.items);
  p.units = p.units.filter((x) => x.id !== id);
}
export function move(p: Player, id: string, slot: number) {
  if (p.blockedSlots?.includes(slot)) throw Error("This field tile is locked.");
  if (!Number.isInteger(slot) || slot < 0 || slot > 43)
    throw Error("Invalid position.");
  const u = p.units.find((u) => u.id === id);
  if (!u) throw Error("Unit not found.");
  const occupant = p.units.find((x) => x.slot === slot);
  if (
    slot < 36 &&
    u.slot >= 36 &&
    !occupant &&
    p.units.filter((x) => x.slot < 36).length >= p.level
  )
    throw Error("Field limit reached. Buy XP to level up.");
  if (occupant) occupant.slot = u.slot;
  u.slot = slot;
}
export function equip(p: Player, id: string, index: number, remove = false) {
  const u = p.units.find((u) => u.id === id);
  if (!u) throw Error("Unit not found.");
  if (remove) {
    if (!u.items[index]) throw Error("Item not found.");
    p.inventory.push(...u.items.splice(index, 1));
  } else {
    if (u.items.length >= 3) throw Error("A unit can carry at most 3 items.");
    if (!ITEM_MAP[p.inventory[index]]) throw Error("Item not found.");
    u.items.push(...p.inventory.splice(index, 1));
  }
}
export function addXP(p: Player, amount: number) {
  p.xp += amount;
  while (p.level < RULES.maxLevel && p.xp >= XP_TO_LEVEL[p.level]) {
    p.xp -= XP_TO_LEVEL[p.level];
    p.level++;
  }
  if (p.level === RULES.maxLevel) p.xp = 0;
}
export function income(p: Player) {
  return (
    RULES.baseIncome +
    Math.min(RULES.interestCap, Math.floor(p.gold / 10)) +
    Math.min(3, Math.floor(Math.abs(p.streak) / 2))
  );
}
