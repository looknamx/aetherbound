# Latest battle statistics and deployment zones

## Authoritative statistics

`shared/battleStats.ts` contains `BattleStatsCollector`, `hpDamage`, and the comparison sorter. `shared/combat.ts` registers each combat actor before simulation and records counters at the authoritative damage/heal/shield/cast event source. Clients render server totals; they never reconstruct totals from animations.

HP damage is `min(remaining HP, max(0, damage after resistance − absorbed shield))`. Overkill is capped, absorbed damage has its own counter, and healing never subtracts from damage. `CombatEvent.value` for damage now means actual HP lost; `absorbed` and `killed` preserve the other outcomes. Lifesteal consequently uses actual HP damage rather than overkill.

Damage attribution uses explicit combat IDs mapped to persistent `unitId` and `ownerId`. Multiple copies of a character have independent rows. A summon maps to its summoner's row: both damage dealt and taken, plus other counters, aggregate there. A summon without a registered owner gets a separate row. Friendly fire counts for the actual source and target, even if attribution ultimately aggregates into one owner row. Only a source damaging that identical combat instance is excluded from Damage Dealt; self-damage still increases Damage Taken.

Future DoT effects must retain the original combat source ID and emit the same authoritative damage event after applying HP loss. The collector preserves source attribution after death. No new DoT ability or periodic effect system was introduced in this change. Tests exercise repeated attributed events. Healing Done, Shield Granted, Units Defeated, Skill Casts and Damage Absorbed are already separate fields; the current UI focuses on Damage Dealt/Taken.

## Snapshot lifecycle

Every simulation creates a new collector and returns a version-1 `BattleStatsSnapshot` with battle ID, round and copied rows. Each row includes persistent and combat IDs, owner, definition, name, portrait key, stars, item list and original formation slot. Summon attribution is additionally explicit in fighter frames.

At Resolving, the engine clones each player's real battle rows into `Player.latestBattleStats`. An echo opponent's secondary battle never overwrites their real result. The snapshot survives the next Preparing phase, sales, upgrades and reconnect. Missing optional fields in older state mean “no data”; an empty participating army has an explicitly empty snapshot. A new battle has a separate snapshot, while the prior completed result remains labelled by its original round until the new result is committed.

The existing simulator computes the full battle synchronously before animation playback. Counters are therefore collected during simulation, not by wall-clock animation callbacks. The UI intentionally displays completed results, with a separate current-round “battle in progress” label, avoiding presentation of precomputed totals as live progress.

`LatestBattleStatsPanel.tsx` renders all historical team rows, including dead/sold/merged cards, defaulting to Damage Dealt descending. It offers Damage Taken and original-position sorting, two labelled/color-distinct meters, compact numbers and expandable exact numeric values. Small cards retain their four corners without added stat clutter.

## Coordinate convention and authority

The whole battlefield remains 6×6. Formation slots are **owner-relative**: `slot = row × 6 + column`, rows 3–5 (slots 18–35) are legal deployment cells. Rows 0–2 are enemy territory. Bench slots remain 36–43, with server-only recovery overflow when necessary.

`shared/deploymentZone.ts` centralizes legal-zone checks, slot-to-point conversion, and reversible canonical/player-relative mappings. In a battle, side 0 uses owner-relative coordinates directly; side 1 rotates both axes by 180 degrees. Cards and Phaser effects use the same mapping for display, so each participant sees their army at the bottom. No six-row compression remains.

`move()` rejects an enemy-half destination or a swap that would send another card to an enemy-half source before mutation. The socket reply has `code: INVALID_PLACEMENT_ZONE` and a Thai explanation. Failed actions leave room revision, seed, update time and replay IDs unchanged. Existing phase deadlines and replay protection still apply; development team edits now also obey the deadline. Developer unit creation remains bench-only.

`repairFormation()` moves invalid legacy field positions into reserves without losing identity/items, using recovery overflow if necessary. It runs at preparation, reconnect, resync/broadcast and before auto-deploy. Any future persisted-room loader must normalize via this same function before publishing state. This repository still has no live-match restore-from-database implementation; that broader feature was not added.

Auto-deploy uses only legal/unblocked/unoccupied cells. Tank/Fighter prefer row 3 near the middle; Assassin prefers row 3 flanks; Ranger/Mage/Support prefer row 5; Summoner prefers row 4. Fallbacks remain within rows 3–5. Combat pathfinding and summons still use the entire 6×6 board and can cross the middle.

## Verification and limits

No game launch, browser automation, screenshots or manual playtests were performed for this change. Verification uses Vitest unit/Socket.IO integration tests, React server-rendering checks, TypeScript, static lint and the production build. Existing browser-test coordinates were updated but browser tests were not run.

The repo previously had no lint command. `npm run lint` adds focused TypeScript-AST checks for explicit `any`, debugger statements and loose equality using the already-installed TypeScript package. It is a small project linter, not a comprehensive ESLint/React accessibility ruleset. `npm run typecheck` runs the existing strict compiler. No dependencies or lockfile were changed. Visual spacing and real pointer behavior remain unverified in a browser as requested; narrow cards still depend on detail panels for full readability.
