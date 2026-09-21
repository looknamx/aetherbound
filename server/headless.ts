import { GameEngine } from "./engine";
import { assertPool } from "../shared/pool";
import { synergies } from "../shared/economy";
import type { Difficulty } from "../shared/strategyTypes";
export function simulateBots(
  seed: number,
  difficulties: Difficulty[] = ["easy", "normal", "hard", "hard"],
) {
  let clock = 1000,
    identity = 0;
  const engine = new GameEngine(
      () => {},
      () => clock,
      () => "sim-" + identity++,
    ),
    host = engine.create("Bot 1");
  for (let i = 1; i < difficulties.length; i++)
    engine.join(host.key, "Bot " + (i + 1));
  const room = engine.rooms.get(host.key)!;
  room.seed = seed;
  room.players.forEach((p, i) => {
    p.bot = { difficulty: difficulties[i], plannedRound: 0 };
    p.ready = true;
  });
  const purchases: Record<string, number> = {},
    items: Record<string, number> = {},
    augments: Record<string, number> = {},
    traits: Record<string, number> = {},
    unitRounds: Record<string, { played: number; won: number }> = {};
  const original = engine.action.bind(engine);
  engine.action = (session, id, action, dev = false) => {
    const p = room.players.find((p) => p.id === session.playerId)!;
    const choice =
      action.type === "choose"
        ? p.pendingChoices?.[action.kind]?.options[action.index]
        : undefined;
    const purchase = action.type === "buy" ? p.shop[action.index] : undefined;
    const seen = session.seen.has(id);
    original(session, id, action, dev);
    if (seen) return;
    if (purchase) purchases[purchase] = (purchases[purchase] ?? 0) + 1;
    if (choice && action.type === "choose") {
      const counts = action.kind === "item" ? items : augments;
      counts[choice] = (counts[choice] ?? 0) + 1;
    }
  };
  engine.action(host, "headless-start", { type: "start" });
  let steps = 0,
    simulatedMs = 0;
  while (room.phase !== "Finished" && steps++ < 400) {
    assertPool(room);
    if (room.phase === "Battling") {
      simulatedMs += Math.max(...room.battles.map((b) => b.duration));
      for (const battle of room.battles)
        for (const [side, pid] of [
          [0, battle.a],
          [1, battle.b],
        ] as const) {
          if (side === 1 && battle.ghost) continue;
          const p = room.players.find((p) => p.id === pid)!;
          for (const def of new Set(
            p.units.filter((u) => u.slot < 36).map((u) => u.defId),
          )) {
            const count = (unitRounds[def] ??= { played: 0, won: 0 });
            count.played++;
            if (battle.winner === side) count.won++;
          }
          for (const trait of synergies(p.units).filter((t) => t.tier > 0))
            traits[trait.id] = (traits[trait.id] ?? 0) + 1;
        }
    }
    clock = room.deadline + 1;
    engine.tick(clock);
  }
  if (room.phase !== "Finished")
    throw Error("Headless match exceeded bounded steps.");
  assertPool(room);
  return {
    seed,
    rounds: room.round,
    steps,
    simulatedMs,
    matchDurationMs: clock - 1000,
    placements: room.players.map((p) => ({
      difficulty: p.bot!.difficulty,
      rank: p.rank,
    })),
    purchases,
    itemSelections: items,
    augmentSelections: augments,
    synergyUsage: traits,
    unitRounds,
    pool: room.pool,
  };
}
export function balanceReport(seeds: number[]) {
  const matches = seeds.map((seed) => simulateBots(seed));
  const units: Record<
    string,
    { picks: number; played: number; wins: number; winRate: number }
  > = {};
  const itemSelections: Record<string, number> = {},
    augmentSelections: Record<string, number> = {},
    synergyUsage: Record<string, number> = {};
  const placements: Record<string, number[]> = {};
  for (const m of matches) {
    for (const [id, n] of Object.entries(m.purchases)) {
      const u = (units[id] ??= { picks: 0, played: 0, wins: 0, winRate: 0 });
      u.picks += n;
    }
    for (const [id, n] of Object.entries(m.unitRounds)) {
      const u = (units[id] ??= { picks: 0, played: 0, wins: 0, winRate: 0 });
      u.played += n.played;
      u.wins += n.won;
      u.winRate = u.wins / u.played;
    }
    for (const [source, target] of [
      [m.itemSelections, itemSelections],
      [m.augmentSelections, augmentSelections],
      [m.synergyUsage, synergyUsage],
    ] as const)
      for (const [id, n] of Object.entries(source))
        target[id] = (target[id] ?? 0) + n;
    for (const p of m.placements)
      (placements[p.difficulty] ??= []).push(p.rank!);
  }
  const totalPicks = Object.values(units).reduce((n, u) => n + u.picks, 0);
  return {
    version: 1,
    seeds,
    matches,
    units: Object.fromEntries(
      Object.entries(units).map(([id, u]) => [
        id,
        { ...u, pickRate: totalPicks ? u.picks / totalPicks : 0 },
      ]),
    ),
    itemSelections,
    augmentSelections,
    synergyUsage,
    averagePlacement: Object.fromEntries(
      Object.entries(placements).map(([d, ranks]) => [
        d,
        ranks.reduce((a, b) => a + b, 0) / ranks.length,
      ]),
    ),
    averageSimulatedMs:
      matches.reduce((n, m) => n + m.simulatedMs, 0) /
      Math.max(1, matches.length),
  };
}
