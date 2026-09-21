import { RULES, UNIT_MAP } from "./content";
import { synergies } from "./economy";
import { isDeploymentSlot } from "./deploymentZone";
import { augmentValue } from "./strategyConfig";
import type { Player, Battle } from "./types";
import type { IncomeBreakdown, CombatSummary } from "./strategyTypes";
export function incomeBreakdown(
  p: Player,
  win: boolean | null,
  round: number,
): IncomeBreakdown {
  const streak = Math.min(3, Math.floor(Math.abs(p.streak) / 2));
  const components = {
    base: RULES.baseIncome,
    interest: Math.min(RULES.interestCap, Math.floor(p.gold / 10)),
    win: win ? 1 : 0,
    loss: 0,
    winStreak: p.streak > 0 ? streak : 0,
    loseStreak: p.streak < 0 ? streak : 0,
    augment:
      augmentValue(p.augments, "income") +
      (Math.abs(p.streak) >= 2 ? augmentValue(p.augments, "streak") : 0),
    other: 0,
    capped: 0,
  };
  const total =
    components.base +
    components.interest +
    components.win +
    components.loss +
    components.winStreak +
    components.loseStreak +
    components.augment +
    components.other -
    components.capped;
  return { round, before: p.gold, after: p.gold + total, total, ...components };
}
export function combatSummary(
  b: Battle,
  p: Player,
  enemy: Player,
  win: boolean | null,
  damage: number,
  round: number,
): CombatSummary {
  const rows = b.stats?.units.filter((u) => u.ownerId === p.id) ?? [],
    side = b.a === p.id ? 0 : 1;
  const top = (field: "damageDealt" | "damageTaken") => {
    const row = [...rows].sort((a, b) => b[field] - a[field])[0];
    return row
      ? { name: UNIT_MAP[row.defId].name, amount: row[field] }
      : undefined;
  };
  const traits = (player: Player) =>
    synergies(player.units)
      .filter((t) => t.count > 0)
      .map((t) => ({ name: t.id, count: t.count, tier: t.tier }));
  return {
    round,
    opponentName: enemy.name,
    events: b.frames
      .flatMap((frame) =>
        frame.events.flatMap((e) => {
          if (
            e.type !== "cast" &&
            e.type !== "death" &&
            e.type !== "shieldBreak"
          )
            return [];
          const source = frame.units.find((u) => u.id === e.source),
            target = frame.units.find((u) => u.id === e.target);
          return source
            ? [
                {
                  tick: e.tick,
                  type: e.type,
                  sourceDefId: source.defId,
                  targetDefId: target?.defId,
                },
              ]
            : [];
        }),
      )
      .slice(-200),
    result: win === null ? "draw" : win ? "win" : "loss",
    playerDamage: damage,
    survivors:
      b.frames.at(-1)?.units.filter((u) => u.side === side && u.hp > 0)
        .length ?? 0,
    topDamage: top("damageDealt"),
    topTaken: top("damageTaken"),
    casts: rows.reduce((n, u) => n + u.skillCasts, 0),
    shieldsGranted: rows.reduce((n, u) => n + u.shieldGranted, 0),
    shieldsBroken: b.frames
      .flatMap((f) => f.events)
      .filter((e) => e.kind === "ShieldBroken" && e.owner === side).length,
    ownTraits: traits(p),
    enemyTraits: traits(enemy),
    augments: [...(p.augments ?? [])],
  };
}
export function synergyAdvice(
  p: Pick<Player, "units" | "level" | "blockedSlots">,
  defId: string,
) {
  const board = p.units.filter((u) => isDeploymentSlot(u.slot));
  const duplicate = board.some((u) => u.defId === defId);
  const free =
    board.length < p.level &&
    Array.from({ length: 18 }, (_, i) => i + 18).some(
      (s) => !p.blockedSlots?.includes(s) && !board.some((u) => u.slot === s),
    );
  const before = synergies(board),
    after = synergies([
      ...board,
      { id: "preview", defId, star: 1, slot: 18, items: [] },
    ]);
  return before
    .filter(
      (t) => t.id === UNIT_MAP[defId].origin || t.id === UNIT_MAP[defId].class,
    )
    .map((t) => {
      const next = after.find((a) => a.id === t.id)!;
      return {
        trait: t.id,
        current: t.count,
        next: next.count,
        tier: t.tier,
        nextTier: next.tier,
        threshold: t.thresholds.find((n) => n > t.count),
        duplicate,
        needsReplacement: !free,
        kind: duplicate
          ? "none"
          : next.tier > t.tier
            ? t.tier === 0
              ? "activate"
              : "upgrade"
            : "progress",
      } as const;
    });
}
