# Rules and MVP assumptions

## World and match

The sky fractured into islands held together by living Aether. Wayfarers gather constructs, spirits and wanderers to carry the last surviving banner. All names, portraits and sound effects in this project are original placeholders.

- Private rooms accept 2–4 players. Everyone must be connected and ready. Only the host starts.
- Start at 100 HP, level 2, 10 gold and one Sunshard relic. No preplaced units.
- Preparing: 30 seconds. Battling: up to 40 simulated seconds. Resolving: 5 seconds.
- Every phase deadline comes from the server. The UI countdown is advisory.
- Pairings rotate each round. With three survivors, the last player attacks an echo of the first; damage to the echo does not affect its owner a second time.
- A battle loss costs `2 + floor(round / 3) + sum(2 × surviving enemy stars)`. Surviving summons cost 1 each. No units on either side, mutual destruction or a 40-second timeout is a draw; both participants lose round-pressure damage only.
- Increasing round pressure guarantees empty-board and stalled matches terminate.
- At 0 HP a player is eliminated and becomes a spectator. The last survivor wins. Simultaneous eliminations are ordered by gold, then server player ID, assigning unique ranks (including a winner if everyone falls together). This tie rule is an explicit MVP decision.
- Disconnects do not pause the match. A disconnected host transfers ownership to a connected player. Refresh restores your seat but does not take host ownership back from an active host.

## Formation and controls

- Six columns × six preparation rows. Eight bench slots. Maximum deployed units equals level (2–8).
- For combat both armies share one 6×6 grid. Each player's six preparation rows compress into three deployment rows, preserving front/back order; the opponent mirrors horizontally and vertically. Collisions occupy the next deterministic free tile in that side's half. This is an MVP layout assumption.
- Mouse: drag recruits and relics, or click recruit then destination. Keyboard: focus recruit, activate, focus tile/bench and activate. Touch: drag, or tap recruit then tile.
- Move onto an occupied tile to swap. You may swap a reserve onto an occupied field tile at the unit limit.
- Click a recruit to inspect. Sell returns full base cost × `3^(star−1)` and all relics. Movement, buying, selling, XP and equipment changes are restricted to preparation and living players.

## Economy and progression

- A shop has five independent rarity rolls, then uniform selection among that rarity's recruits. No finite shared supply in this MVP.
- Refresh costs 2 gold. Lock preserves all five offers, including purchased empty slots, until unlocked; refresh still works while locked.
- Buy 4 XP for 4 gold. Gain 2 XP every resolved round. XP thresholds for levels 2→8: 4, 8, 12, 20, 28, 36.
- Round income: 5 base + min(5, floor(gold / 10)) interest + min(3, floor(abs(streak) / 2)) streak bonus + 1 for a victory. Draw resets the streak.
- Three matching units at the same star automatically merge. Upgrades can cascade to 3 stars. The lowest occupied slot survives. HP, attack and spell power multiply by 1 / 1.8 / 3.24; other base stats stay unchanged.
- Merging keeps the first three relics and returns overflow to inventory. A full bench can still buy a unit that immediately merges. There is no 4-star upgrade.

## Combat and relics

- Server-only simulation, fixed 250 ms ticks and a seeded PRNG; identical inputs and seed produce identical frames.
- Breadth-first grid pathfinding avoids living occupied tiles. Target behavior is nearest, weakest or farthest according to the recruit. Manhattan distance determines attack range and area effects.
- Physical/magic damage uses armor/resistance: nonnegative resistance scales damage by `100/(100+resistance)`; negative resistance uses `2−100/(100−resistance)`. Shields absorb first. Base crit chance is 10%, critical basic attacks deal 150%.
- Attacks generate 20 mana, receiving damage generates 8, Moonwell adds 5 per attack. Max mana triggers a spell unless silenced, with a 2-second spell cooldown. Stun blocks actions; slow halves movement/attack speed for 3 seconds; silence blocks spells for 3 seconds. Healing cannot resurrect.
- Summoners have a two-echo lifetime cap per caster per battle. Summons do not cast or inherit relic passives. Death, spells, statuses, heals, shields and attacks are explicit log events.
- Traits count **unique deployed recruit definitions**, not copies. Thresholds are 2 and 4 and apply bonuses to the entire army. Each recruit has one origin and one class; all 10 trait effects are implemented.
- At round resolution there is a seeded 45% relic drop chance, uniform across the 12 relics. A unit carries at most three. Equipping/unequipping is free during preparation. Item drops stop at 90 inventory relics to keep state bounded.
- UI replay speed and reduced motion do not alter outcomes, input validation or phase deadlines. Audio uses original synthesized tones and defaults off.

All balance numbers live in `shared/content.ts`; rules are executable in `shared/economy.ts`, `shared/combat.ts` and `server/engine.ts`.
