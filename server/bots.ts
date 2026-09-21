import { UNIT_MAP } from "../shared/content";
import {
  DIFFICULTY,
  AUGMENT_MAP,
  augmentValue,
} from "../shared/strategyConfig";
import { synergyAdvice } from "../shared/roundInsights";
import { isDeploymentSlot } from "../shared/deploymentZone";
import { chooseAutoDeploySlot } from "../shared/boardPlacement";
import { permanentStats } from "../shared/stats";
import { suggestedRole } from "../shared/choices";
import { scoutingView } from "./views";
import type { Action, Player, Room, Unit } from "../shared/types";
import type { BotPerception } from "../shared/strategyTypes";
export function perceiveBot(room: Room, p: Player): BotPerception {
  return {
    gold: p.gold,
    level: p.level,
    units: structuredClone(p.units),
    shop: [...p.shop],
    inventory: [...p.inventory],
    opponents: room.players
      .filter((x) => x.id !== p.id)
      .map((x, i) => scoutingView(x, i)),
  };
}
function strength(u: Unit) {
  const s = permanentStats(u);
  return (
    u.star * 1000 +
    UNIT_MAP[u.defId].cost * 100 +
    s.attack * s.speed +
    s.maxHp * 0.1
  );
}
function bonusScore(id: string, p: Player) {
  const effect = AUGMENT_MAP[id].effect,
    field = p.units.filter((u) => isDeploymentSlot(u.slot));
  switch (effect) {
    case "ember":
      return (
        field.filter((u) => UNIT_MAP[u.defId].origin === "Emberkin").length * 3
      );
    case "rookie":
      return field.filter((u) => u.star === 1).length * 2;
    case "items":
      return field.reduce((n, u) => n + u.items.length, 0) * 2;
    case "frontArmor":
      return field.filter((u) => Math.floor(u.slot / 6) === 3).length * 2;
    case "backRange":
      return field.filter((u) => Math.floor(u.slot / 6) === 5).length * 2;
    case "streak":
      return Math.abs(p.streak) >= 2 ? 7 : 2;
    case "income":
      return 6;
    case "reroll":
      return p.level >= 5 ? 6 : 3;
    default:
      return 4;
  }
}
export function planBot(
  room: Room,
  p: Player,
  rerolls: number,
): Action | undefined {
  const profile = DIFFICULTY[p.bot!.difficulty],
    view = perceiveBot(room, p);
  for (const kind of ["item", "augment"] as const) {
    const pending = p.pendingChoices?.[kind];
    if (pending) {
      const index =
        kind === "item"
          ? Math.max(
              0,
              pending.options.findIndex((id) =>
                p.units.some(
                  (u) => UNIT_MAP[u.defId].role === suggestedRole(id),
                ),
              ),
            )
          : p.bot!.difficulty === "easy"
            ? 0
            : pending.options
                .map((id, index) => ({ index, score: bonusScore(id, p) }))
                .sort((a, b) => b.score - a.score || a.index - b.index)[0]
                .index;
      return { type: "choose", kind, round: pending.round, index };
    }
  }
  if (room.phase !== "Preparing") return;
  const field = p.units.filter((u) => isDeploymentSlot(u.slot)),
    bench = p.units.filter((u) => u.slot >= 36);
  const occupied = new Set(field.map((u) => u.slot));
  const strongest = [...bench].sort((a, b) => strength(b) - strength(a))[0];
  if (strongest && field.length < p.level) {
    const slot = chooseAutoDeploySlot(strongest, occupied, p.blockedSlots);
    if (slot !== undefined) return { type: "move", unitId: strongest.id, slot };
  }
  const weakest = [...field].sort((a, b) => strength(a) - strength(b))[0];
  if (strongest && weakest && strength(strongest) > strength(weakest))
    return { type: "move", unitId: strongest.id, slot: weakest.slot };
  if (p.inventory.length) {
    const item = p.inventory[0],
      candidates = field
        .filter((u) => u.items.length < 3)
        .sort(
          (a, b) =>
            Number(UNIT_MAP[b.defId].role === suggestedRole(item)) -
              Number(UNIT_MAP[a.defId].role === suggestedRole(item)) ||
            strength(b) - strength(a),
        );
    if (candidates[0])
      return { type: "equip", unitId: candidates[0].id, itemIndex: 0 };
  }
  const scored = view.shop
    .flatMap((id, index) => {
      if (!id || UNIT_MAP[id].cost > view.gold) return [];
      const pairs = view.units.filter(
        (u) => u.defId === id && u.star === 1,
      ).length;
      const synergy = synergyAdvice(p, id).reduce(
        (n, s) =>
          n +
          (s.nextTier - s.tier) * profile.synergy +
          (s.next - s.current) * profile.synergy * 0.2,
        0,
      );
      return [
        { index, id, score: pairs * 200 + UNIT_MAP[id].cost * 20 + synergy },
      ];
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const buy = scored[0],
    floor = room.round <= 3 ? 0 : profile.reserve;
  if (
    buy &&
    (p.gold - UNIT_MAP[buy.id].cost >= floor ||
      field.length < p.level ||
      p.units.filter((u) => u.defId === buy.id && u.star === 1).length >= 2)
  ) {
    if (
      bench.length < 8 ||
      p.units.filter((u) => u.defId === buy.id && u.star === 1).length >= 2
    )
      return { type: "buy", index: buy.index };
    const expendable = [...bench].sort((a, b) => strength(a) - strength(b))[0];
    if (
      expendable &&
      strength(expendable) < 1000 + UNIT_MAP[buy.id].cost * 100 + 150
    )
      return { type: "sell", unitId: expendable.id };
  }
  if (p.level < 8 && p.gold >= floor + 4 && (bench.length > 0 || p.gold >= 30))
    return { type: "xp" };
  if (p.bot!.difficulty === "hard" && field.length) {
    const threats = view.opponents
      .flatMap((o) => o.units)
      .sort((a, b) => strength({ ...b, id: "" }) - strength({ ...a, id: "" }));
    const front = field.find((u) => UNIT_MAP[u.defId].role === "Tank");
    if (front && threats[0]) {
      const desired = 18 + (5 - (threats[0].slot % 6));
      if (
        front.slot !== desired &&
        !occupied.has(desired) &&
        !p.blockedSlots?.includes(desired)
      )
        return { type: "move", unitId: front.id, slot: desired };
    }
  }
  if (
    rerolls < profile.rerolls &&
    p.gold >= floor + Math.max(1, 2 - augmentValue(p.augments, "reroll"))
  )
    return { type: "reroll" };
}
