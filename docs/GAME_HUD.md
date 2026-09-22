# Aetherbound viewport HUD — 22 September 2026

## Structure

The old match page stacked a header, three-column game area, bench, language controls, rewards, bonuses, income, statistics and a full shop in normal document flow. Opening more detail expanded the page and separated purchasing from deployment.

The new `GameShell` uses `100dvh` with explicit rows for `TopHud`, the board/sidebar area, reserves and the action bar. Each flexible grid track has a zero minimum; side panels scroll internally. Body overflow stays **visible during ordinary play**. Only a modal locks body scrolling. No page zoom or whole-page scaling is used.

- `client/hud/GameShell.tsx`: phase-aware shell, scouting in the same board viewport, roster, context slots, action bar, overlay priority and reward confirmation.
- `client/hud/Overlay.tsx`: portal, named ARIA dialog, focus trap/restore, inert background, Escape/backdrop rules, scroll lock and modal/bottom/side/popover variants. Native `title` tooltips handle simple labels without container clipping.
- `client/hud/TeamStatistics.tsx`: sortable damage dealt/taken, healing and shield, using an explicit display projection.
- `client/hud/FieldGuide.tsx`, `labels.ts`, `hud.css`: guide, Thai/English controls, design tokens and responsive sizing.
- `client/main.tsx`: existing authoritative action handlers and card components are passed into the shell; opening panels does not issue gameplay actions.
- `client/cards/CardBoard.tsx`: compact host mode removes the in-flow event log and sends inspection to the shared overlay. Combat rendering/calculations remain unchanged.

The original Aetherbound palette, portraits and card component are retained. At small board sizes, a card dedicates rows to ATK/DEF, its short name, stars and health; its portrait remains a faint background. Full role, rarity, skills and items remain available in inspection. Recovered reserve units remain accessible in the context panel.

## Panels and phases

Shop is a bottom drawer with the same five authoritative offers, odds, lock/reroll controls, purchases and per-card details/synergy disclosure. Items use a side drawer; selecting an item closes it for board targeting. Bonuses, guide and settings use informational overlays. Statistics and round summary share result/statistics/income/events tabs. Long descriptions and logs no longer extend the match page.

Preparation keeps the board, bench, economy and system buttons visible. Scouting replaces the central board temporarily and returns automatically when preparation ends. Battle locks mutations while allowing inspection and readable combat feedback. Resolving uses a short board caption; full reports open through the action bar. Finished opens rankings with Home and Play again. Play again disconnects the previous bound transport before creating a new room, preserves the selected practice difficulty, and resets local HUD state for the new room key.

Priority is **connection → finished → item choice → augment choice → selected informational panel/detail**. Only one active overlay is rendered; mandatory server choices supersede voluntary panels. Shop closes on leaving preparation. Mandatory choices cannot be dismissed with Escape/backdrop, keep their server options across reconnect and guard against repeated submission. A short confirmation identifies the selected or timed-out reward. Informational panels restore focus and support Escape/backdrop dismissal. Summary tabs support arrow keys.

There is **no mandatory recruit/card-draft phase in the existing authoritative protocol**. This change does not invent such a gameplay phase or show a nonfunctional card-choice modal. Existing card purchases remain in the shop drawer; the shared mandatory overlay mechanism handles the actual item and augment choices.

## Retained round data

Preparation clears the full replay. To keep the Events tab and opponent label useful after that transition/reconnect, `CombatSummary` now stores an optional opponent display name and at most 200 important cast/death/shield-break records containing ticks and catalog definition references. `shared/roundInsights.ts` derives these from completed frames. No damage, targeting, economy, RNG, bot or pool calculations change. Older summaries without these additive fields remain readable.

## Responsive verification

Browser automation measured every target with body overflow **visible**, captured screenshots, and verified document dimensions equal the viewport dimensions. No vertical or horizontal page overflow was present in the captured normal-play states:

| Viewport | Grid-cell width | Layout |
| --- | ---: | --- |
| 1920×1080 | 104.3 px | Three columns, bottom reserves |
| 1600×900 | 78.9 px | Three columns, bottom reserves |
| 1440×900 | 79.9 px | Three columns, bottom reserves |
| 1366×768 | 61 px | Three columns, bottom reserves |
| 1280×720 | 54.5 px | Three columns, bottom reserves |
| 1024×768 | 63 px | Narrow side panels |
| 844×390 | 44 px | Sidebars become drawers; reserves alongside the board |
| 390×844 | 55.3 px | Full-screen sheets; reserves and actions scroll horizontally within their bars |

At short mobile landscape heights, putting reserves beside the board preserves usable cell targets. Desktop/laptop reserves remain below the board. Mobile full-screen sheets and long overlays scroll internally. Screenshot evidence and measured JSON are kept under ignored `test-results/hud/`; they are not staged or committed.

Real browser checks also exercised shop purchasing (gold and reserves updated), mandatory choices, reconnect, automatic return from scouting at battle start, income tabs, Escape/focus restoration and Finished → Play again → round 1 with starting resources. Screenshots covered the normal HUD, shop and mandatory rewards. Compact-card layout was corrected after visual review. Browser extension diagnostics occurred during one automation click; the purchase state was inspected before continuing. No application-origin error was observed in the inspected browser log.

## Automated verification and limits

- `npm test`: **186/186 tests in 14 files passed**, including 20 HUD tests plus a real Socket.IO regression for fresh-connection replay. The original HUD-task baseline was 165 passing tests.
- Type checking and production build: passed; Vite transformed 96 modules.
- Focused AST lint: passed.
- Existing server, multiplayer/privacy/reconnect, pool, combat and headless deterministic bot tests remain passing.
- The legacy standalone Playwright suite was not run in this task; it still targets several old in-flow selectors. Verification used the connected browser plus the unit/Socket.IO suite. There are saved screenshots, not pixel-diff golden baselines.
- This is browser viewport verification, not a physical touchscreen or screen-reader certification. Very short windows outside the tested sizes can require additional tuning. Mobile action/bench bars deliberately use internal horizontal scrolling.

On resuming on 22 September, the repository already contained commit `73b7684` with the earlier HUD work; that history was preserved. Follow-up fixes and this report are prepared for commit and push at the user's request.
