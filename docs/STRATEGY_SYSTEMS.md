# Strategy systems — 21 September 2026

## Architecture and contracts

The authoritative `server/engine.ts` owns actions, the shared room pool and phase transitions. The loop is Preparing → Battling → Resolving → Choosing (only configured reward rounds) → Preparing. Choice timeout is 20 seconds; the server selects option zero for unfinished choices. Actions carry protocol version **2**; old clients must reload. Snapshot state is version 2. `shared/migration.ts` fills legacy defaults, repairs placement, validates choices/bonuses and reconstructs missing pools. Legacy holdings above configured supply are grandfathered rather than deleted. This is an explicit in-memory restore boundary, not a new durable database/restart recovery service.

Contracts/configuration live in `shared/strategyTypes.ts`, `strategyConfig.ts`, `protocol.ts` and `combatEvents.ts`. Server projections are in `server/views.ts`. React controls and Thai/English text are under `client/strategy/`. All seven systems are enabled; none is an unfinished feature behind a flag.

## Scouting

The strict allowlist DTO includes seat, name, health, level, connection/elimination status, deployed definitions/stars/positions/items, trait counts/tiers/next threshold and selected bonuses. It contains no unit UUID, seed, pool counts, bench, inventory, shop, gold, XP or pending rewards. Ordinary opponent player snapshots also hide private state. Own player state remains private to its session; battle actor IDs still exist internally for playback and are never interpolated into display text.

Scouting is read-only during preparation, updates from authoritative snapshots and returns to the own board when combat starts. Shop/bench remain the player's own. Server ownership validation applies regardless of which board the UI displays.

## Practice and bots

Practice creates one human and three bots at the selected difficulty. Bots call the same validated action handler and spend the same gold, XP, pool stock and item slots. No extra currency, damage or opponent private choices are supplied.

| Difficulty | Decisions per preparation | Reserve after round 3 | Rerolls | Strategy |
| --- | ---: | ---: | ---: | --- |
| Easy | 8 | 0 | 0 | Basic upgrades, strongest deployment and role-based equipment |
| Normal | 20 | 10 | 1 | Pair/synergy scoring, economy and team-aware bonus selection |
| Hard | 32 | 20 | 2 | Higher synergy weighting, economy and frontline repositioning using public threats |

Budgets include all attempted decisions and are bounded. Rewards are selected during Choosing. Ties are stable; given the same seed and actions, simulations are reproducible. These are heuristic profiles, not a guarantee that Hard wins more often.

## Rewards and bonuses

Items are offered after rounds **1, 3, 5, 7, 9**. Bonuses are offered after **2, 5, 8**. Each offer contains three unique seeded choices. Basic items have weight 3; passive items have weight `1 + floor(round / 3)`. Choices persist across reconnect, reject wrong rounds/indexes and cannot award twice. Inventory capacity is 90; overflow queues without loss and drains when space opens. Bonus options exclude already selected and conflicting bonuses; bonuses last for the match with battle-specific conditions reapplied each combat.

| Bonus | Implemented effect |
| --- | --- |
| Cloud Bastion | Starting front row +18 armor |
| Wind Tempo | +12% attack speed |
| Firstlight Spring | +20 starting mana |
| Isle Artisan | Item primary stat bonuses +25%, excluding passives |
| Wayfarer Stipend | +1 income |
| Steady Resolve | +2 income at absolute streak 2+; conflicts with Stipend |
| United Embers | Emberkin +20 attack |
| Little Stars | One-star units +180 HP |
| Defiant Few | +150 shield per unit when starting outnumbered |
| Hidden Atlas | Cost-3 shop weight ×1.5, then normalized |
| Trade Route | Reroll price 1 instead of 2 |
| Sky Lookout | Starting back row +1 range |

Effects are consumed by combat stat construction, shop weights/cost or actual income, not merely descriptions. No bonus stacks with itself.

## Shared supply and shop advice

Supply **per definition** at costs 1–5 is **30 / 24 / 18 / 12 / 9**. Shop offers reserve immediately; a buy transfers that reservation into ownership. Reroll returns the old offers before reserving new ones. Locked shops keep their reservations. Selling returns 1/3/9 copies for 1/2/3 stars, merging conserves copies, and elimination returns shop and owned units. Summons consume no pool stock. Exhausted rarity uses a bounded nearest-rarity search; an exhausted whole pool produces empty slots. `available + reserved shops + owned copies = total` is asserted in tests/simulations. Synchronous action handling serializes competing requests in this single-process room architecture.

`synergyAdvice` calls the same `synergies` calculation as combat, counting distinct definitions on legal board cells only. It compares current and hypothetical thresholds, distinguishes activation/upgrades/progress, and warns that a full board needs replacement; buying alone never claims to activate a trait.

## Combat and income

Every emitted event carries a monotonic sequence, tick and descriptive kind. Events include Move, AttackStarted, DamageApplied, SkillCastStarted, SkillCastResolved, HealApplied, ShieldGranted, ShieldDamaged, ShieldBroken, DebuffApplied, UnitSummoned, TargetChanged, CriticalHit, UnitDied and BattleEnded. Optional fields carry source/target, amount, damage type, effect and position. EventCursor drops duplicates and old deliveries; reconnect starts at the current server cursor. UI provides skill/death/shield-break feedback, positive-HP-damage feedback and a bounded readable combat log.

Round summaries derive from actual battle statistics/events: damage leaders, damage taken, casts, shields, survivors, health loss, traits and bonuses. The latest summary survives later phases/reconnect.

Income records round, before/after gold, total and base/interest/win/loss/winStreak/loseStreak/augment/other/capped components. Interest uses pre-income gold, capped by existing rules; streak is updated before calculation. Components sum to the exact credited amount. Loss/other/capped are currently zero under existing rules, not invented bonuses.

## Verification and limits

Baseline: 130 passing tests, no pre-existing failure. Final: **165 tests across 13 files**, typecheck, focused AST lint and production build all passed. Coverage includes real Socket.IO privacy/ownership/reconnect, pool conservation/last copy, idempotent rewards, bonus effects, deterministic events, seeded full bot matches and isolated React interactions in happy-dom. No game, browser, manual playtest or Playwright run was performed. Visual layout/touch behavior remains unverified in a browser.

`npm run simulate -- 10 21` completed seeds 21–30 and saved `artifacts/balance/latest.json`. The report contains purchases/pick rates, unit combat-round win rates, items, bonuses, traits, placements and simulated duration. `simulatedMs` counts combat time; each match's `matchDurationMs` also includes scheduled phase waits. The sample averaged 13 rounds and 291,850 ms combat time. Average placement: Easy 2.10, Normal 2.60, Hard 2.65 (two Hard seats per match). This small fixed-seat sample shows that reserve/upgrade heuristics need balance work; it does **not** establish the intended difficulty ordering. Broader seeds and rotated seats are appropriate next steps. Unit win rates are combat-round outcomes, not causal measures of unit strength.

Reconnect works within the running server; durable sessions/process restart recovery and multi-process concurrent room writers are outside this change. All work remains uncommitted; no push was made.
