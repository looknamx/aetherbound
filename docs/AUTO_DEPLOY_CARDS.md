# Auto-deploy and shared cards

## Authoritative transition

`server/engine.ts` locks Preparing → Battling synchronously, then runs `shared/autoDeploy.ts` once per living player, including disconnected players, before constructing combat snapshots. Commands received after the preparation deadline are rejected. No client auto-deploy command exists. Repeated transition calls do nothing.

Auto-deploy removes transient summons, resolves three-copy merges, repairs invalid/overlapping/excess formations, fills vacancies, and validates the result. Existing legal deployed units stay where the player placed them. Unit IDs, stars and relics are retained. Recovery-only reserve slots beyond the usual eight preserve units if a legacy formation cannot fit; the UI exposes them for recovery.

The server broadcasts final formations and deployment reports together. Report IDs include room, round and player. The client animates only a newly observed transition; reconnect renders the committed formation without replaying the animation. The server also computes read-only bench recommendations with the same service on a clone.

## Deterministic selection

Candidates are compared lexicographically, descending:

1. Star level.
2. Rarity rank (the current content encodes rarity in cost 1–5).
3. Purchase cost.
4. Power = `0.1 × maxHP + ATK × attackSpeed + Armor + MagicResistance`, using permanent star/item stats.
5. Increase in the sum of activated synergy tiers, recomputed after each placement.
6. Earlier bench position, then lexical unit ID for a final stable tie.

Weights live in `shared/autoDeployScoring.ts`. Rarity and cost are separate tuple entries for future content, but currently have the same value. This is a predictable fallback formation, not a tactical optimizer.

## Placement

Rows are zero-based, with row 0 at the preparation front. `ROLE_CONFIG` in `shared/content.ts` contains the full fallback order.

| Role | Preferred row | Column preference |
|---|---|---|
| Tank | 0, then 1 | Center outward |
| Fighter | 1, then 0 | Center outward |
| Assassin | 1, then 2 | Flanks inward |
| Ranger / Mage / Support | 5, then 4 | Center outward |
| Summoner | 3, then 4 | Center outward |

Occupied and blocked cells are skipped. Every role has all six rows as fallbacks. Stop when the level limit (clamped to 0–8), available recruits, or legal cells are exhausted. Combat retains the existing six-to-three-row compression for each army.

## Card calculations and components

`shared/stats.ts` is the source for both card values and combat initialization:

- Permanent ATK = definition ATK × star multiplier (1 / 1.8 / 3.24) + item attack bonuses.
- Permanent Armor and Magic Resistance include their item bonuses; star upgrades do not multiply them under the existing rules.
- Display DEF = `round((Armor + MagicResistance) / 2)`. It is an equal-weight summary. Physical and magical damage still use their individual resistance values.
- Combat ATK/DEF use authoritative fighter-frame values after synergy modifiers. A signed colored delta distinguishes them from permanent stats. HP, mana, shields and statuses come from live frames.

`client/cards/UnitCard.tsx` supplies shop, bench, board, detail, drag and preview variants. Each has ATK top-left, DEF top-right, role bottom-left, and rarity/cost bottom-right. Text and symbols supplement rarity colors. The same component provides portrait, traits, stars, relic slots and status bars; the detail panel exposes full names, skill and individual defenses.

`CardBoard.tsx` keeps Phaser terrain/effects below DOM cards, allowing keyboard/touch inspection and readable semantic values. `CardDragPreview.tsx` and `useAutoDeployFeedback.ts` reuse the card for drag/deployment feedback. Reduced-motion preferences suppress deployment flights.

## Important files

- Shared rules: `shared/autoDeploy.ts`, `autoDeployScoring.ts`, `boardPlacement.ts`, `stats.ts`, `content.ts`, `types.ts`.
- Server integration: `server/engine.ts`, `server/app.ts`; blocked-cell movement validation: `shared/economy.ts`.
- Rendering: `client/cards/*`, `client/main.tsx`, `client/Board.tsx`.
- Coverage: `tests/autoDeploy.test.ts`, `autoDeploy-network.test.ts`, `cards.test.tsx`, `e2e/autoDeploy.spec.ts`.

## Remaining limits

Small mobile board tiles abbreviate names and roles; tap a card for full readable details. Shop cards scroll horizontally. Portraits remain original geometric placeholders. Role preferences and power weights are configurable heuristics and will benefit from balance playtests. Reconnect survives a client disconnect, but live rooms still do not survive a server restart. Automated visual checks cover desktop 1440×1080 and mobile 390×844, not every device/browser combination.
