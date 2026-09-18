# Test report — 18 September 2026

## Latest correction: safe player-facing statistics details

- `npm test`: **130/130 passed** across 10 files, including UUID regression tests and React keyboard/ARIA/sorting tests in an isolated happy-dom environment.
- `npm run typecheck` and `npm run lint`: passed.
- `npm run build`: passed (84 modules). Final focused panel tests: **25/25 passed**. `git diff --check`: passed; only Windows line-ending conversion notices.
- Added pinned development-only `happy-dom` for non-browser interaction tests; the lockfile records that addition. Combat calculations, shared gameplay and server code are unchanged in this correction.
- Internal IDs/metadata are excluded by an explicit display projection. Thai labels, validated round numbers, finite numeric formatting and exact-value details replace raw interpolated IDs.
- No game or browser was opened, no manual playtest was performed, and no commit/push was made. Layout behavior is not visually verified in a browser.
- See [root cause, display rules and regression coverage](docs/STATS_DISPLAY_FIX.md). Earlier results below belong to prior changes.

## Latest change: battle statistics and deployment zones

- Baseline before edits: **51/51 tests passed**. No pre-existing failures were observed.
- Final `npm test`: **107/107 passed across 10 files**, including unit tests, React server-rendering tests and real two-client Socket.IO integration tests without a browser.
- `npm run typecheck`: passed.
- `npm run lint`: passed. This new focused AST linter checks explicit `any`, debugger statements and loose equality; it uses installed TypeScript without adding dependencies.
- `npm run build`: passed (84 modules transformed).
- New coverage: actual HP damage after resistance/shields, overkill, repeated DoT-source events, healing, self-damage, summon attribution/friendly fire, instance identity, dead-unit retention, snapshot survival after sale/merge/reconnect, round separation, echo battle attribution, sorting and missing-data UI.
- Deployment coverage: all 18 legal and 18 illegal cells, bench/field moves and invalid swaps, atomic error responses, replay protection, coordinate round trips, legal auto-deploy and exhausted cells, legacy repair/reconnect, and unrestricted battle pathfinding across the middle.
- Socket integration verifies `INVALID_PLACEMENT_ZONE`, unchanged state after rejection, identical authoritative stats for both clients, rejected forged statistics and serialized latest results on reconnect.
- No dependency or lockfile changes. Browser test fixtures were adjusted to the new legal rows but **not executed**.
- **No game was launched, no browser opened and no manual playtest performed for this change.** Only isolated automated integration servers were started by tests. Visual layout and actual pointer/touch behavior are not browser-verified.
- All changes remain uncommitted in the working tree; no push was performed.

See [implementation, rules and remaining limits](docs/BATTLE_STATS_DEPLOYMENT.md). The screenshots and interactive results below are **historical evidence from 17 September**, not validation of this change.

# Previous test report — 17 September 2026

## Automated verification

Environment: Windows, Node 24.19.0, npm 11.17.0; local authoritative server and Chromium.

| Command | Result |
|---|---|
| `npm run build` | Passed: TypeScript and production Vite bundle |
| `npm test` | 51 tests passed, including existing gameplay tests |
| `npm run test:e2e` | 4 browser scenarios passed (about 2.2 minutes) |
| `git diff --check` | Passed; Git reports only Windows line-ending conversion notices |

New automated coverage includes 2/4 → 4/4 and 2/4 → 3/4, full/empty boards, zero limit, deterministic priority and ties, role placement, blocked/overlapping cells, star merges, preserved relics, transient summons, legacy over-limit repair, preview immutability, duplicate transitions, deadline rejection, disconnected players, shared ATK/DEF and all six card variants.

Two real Socket.IO clients verify equal deployed formations/battle snapshots, reconnect restoration and rejection of a forged auto-deploy action. Browser tests cover partial boards, natural preparation expiry, matching combat cards on both clients, reconnect during combat without replaying flights, two battle rounds, live card inspection, desktop bounds and mobile 390×844 tap controls. Existing economy/drag/merge/relic/sell/reroll/XP/reconnect/final-ranking scenarios continue to pass.

## Additional interactive two-client playthrough

Opened two separate tabs at `http://localhost:3001`, created room WLZUMY, joined as Arden Cards and Lyra Cards, readied both and started through the UI. No direct state injection was used.

- Arden bought Cinder Sentry and Reef Harrier and left the field empty. Preparation expiry deployed both (2/2); Cinder occupied front tile 3 and Reef the back line.
- Lyra bought Nova Scribe. The next attempted shop purchase crossed the deadline and the disabled button prevented it. Nova deployed automatically (1/2).
- First resolution displayed the same HP on both clients: Arden 100, Lyra 94.
- Later preparation: Lyra bought Cinder and Brook, leaving them on the bench. The next observed combat showed 3/3 and “จัดทีมอัตโนมัติ: ลงสนามเพิ่ม 2 ใบ”. Arden retained his existing formation at 2/3 with no extra bench units available.
- Both clients reached round 4 preparation, confirming more than two completed battle phases. Both showed Arden 91 HP and Lyra 88 HP.
- No application-origin warnings/errors appeared in either browser console. Each tab had an unrelated browser-extension `content.js` error with message `Object`; these are recorded rather than attributed to the game. The running server emitted no new errors during the playthrough.

## Screenshots reviewed

- [Shop, bench and preparation board](artifacts/cards/01-shop-bench-board.png)
- [Shop cards](artifacts/cards/02-shop.png)
- [Bench cards](artifacts/cards/03-bench.png)
- [Live battle board](artifacts/cards/04-battle-board.png)
- [Formation after deployment](artifacts/cards/05-deployed-board.png)
- [Mobile cards and detail panel](artifacts/cards/06-mobile-cards.png)

Desktop and mobile screenshots were visually inspected. Cards fit their cells; the narrow mobile board uses compact labels, with full stats available by tapping. The market scrolls horizontally on mobile. Baseline flow screenshots under `artifacts/playtest/` were also refreshed by the retained browser suite.

## Reproduce

```powershell
npm ci
npm run db:generate
npm run dev
```

Open `http://localhost:5173` in two independently opened tabs; create/join the same room, ready both and start. Buy recruits and leave some on the bench until the 30-second timer expires. For the production build, run `npm run build` followed by `npm start`, then open `http://localhost:3001`.

Run automated checks with `npm run build`, `npm test`, then `npm run test:e2e`. The E2E suite starts its own test server on port 3101. Development helpers are available only with the existing explicit development configuration; they are not required for normal auto-deploy.

See [implementation rules, important files and remaining limits](docs/AUTO_DEPLOY_CARDS.md). PostgreSQL and server-restart recovery were not tested in this change; the latter is not implemented. Changes remain in the working tree, without commit or push.
