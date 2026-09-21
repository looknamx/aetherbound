import { ITEM_MAP, ITEMS, UNIT_MAP } from "./content";
import { RNG } from "./random";
import { AUGMENT_MAP, eligibleAugments, STRATEGY } from "./strategyConfig";
import type { Player } from "./types";
import type { ChoiceKind } from "./strategyTypes";
export function itemWeight(id: string, round: number) {
  return ITEM_MAP[id].passive ? 1 + Math.floor(round / 3) : 3;
}
function weightedPick(ids: string[], rng: RNG, weight: (id: string) => number) {
  const result: string[] = [];
  const remaining = [...ids];
  while (result.length < 3 && remaining.length) {
    let roll = rng.next() * remaining.reduce((n, id) => n + weight(id), 0);
    let index = remaining.findIndex((id) => (roll -= weight(id)) < 0);
    if (index < 0) index = remaining.length - 1;
    result.push(...remaining.splice(index, 1));
  }
  return result;
}
export function offerChoices(p: Player, round: number, rng: RNG) {
  p.pendingChoices ??= {};
  if (STRATEGY.itemRounds.includes(round) && !p.pendingChoices.item)
    p.pendingChoices.item = {
      round,
      options: weightedPick(
        ITEMS.map((i) => i.id),
        rng,
        (id) => itemWeight(id, round),
      ),
    };
  if (STRATEGY.augmentRounds.includes(round) && !p.pendingChoices.augment) {
    const options = weightedPick(
      eligibleAugments(p.augments ?? []).map((a) => a.id),
      rng,
      () => 1,
    );
    if (options.length === 3) p.pendingChoices.augment = { round, options };
  }
}
export function choose(
  p: Player,
  kind: ChoiceKind,
  round: number,
  index: number,
) {
  const choice = p.pendingChoices?.[kind];
  if (
    !choice ||
    choice.round !== round ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= choice.options.length
  )
    throw Error("ตัวเลือกไม่ถูกต้องหรือเลือกไปแล้ว");
  const id = choice.options[index];
  if (kind === "item") {
    if (!ITEM_MAP[id]) throw Error("Unknown item choice.");
    if (p.inventory.length < STRATEGY.inventoryLimit) p.inventory.push(id);
    else (p.rewardOverflow ??= []).push(id);
  } else {
    if (
      !AUGMENT_MAP[id] ||
      !eligibleAugments(p.augments ?? []).some((a) => a.id === id)
    )
      throw Error("โบนัสนี้ใช้ร่วมกับโบนัสที่มีอยู่ไม่ได้");
    (p.augments ??= []).push(id);
  }
  delete p.pendingChoices![kind];
}
export function drainRewards(p: Player) {
  while (
    p.inventory.length < STRATEGY.inventoryLimit &&
    p.rewardOverflow?.length
  )
    p.inventory.push(p.rewardOverflow.shift()!);
}
export function suggestedRole(itemId: string) {
  const i = ITEM_MAP[itemId];
  return i.stat === "armor" ||
    i.stat === "hp" ||
    i.passive === "lifeline" ||
    i.passive === "thorns"
    ? "Tank"
    : i.stat === "mana"
      ? "Mage"
      : "Ranger";
}
export function itemCandidates(p: Pick<Player, "units">, itemId: string) {
  return p.units
    .filter(
      (u) =>
        u.items.length < 3 && UNIT_MAP[u.defId].role === suggestedRole(itemId),
    )
    .map((u) => UNIT_MAP[u.defId].name);
}
