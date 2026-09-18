# Player-facing statistics display correction

The old `LatestBattleStatsPanel.tsx` directly interpolated `unitId` and `battleId` after `Round`. This was the source of the long technical strings. There was no Zone renderer in this component. Combat calculations and server payloads are unchanged.

`client/cards/battleStatsDisplay.ts` now projects a strict allowlist into a display model: a validated round label, known character name/portrait, stars, sorting position, numeric damage totals, shield absorption and skill casts. It copies no server object or metadata. Character labels come from the trusted content catalog; unknown definitions receive a readable fallback, never an ID or untrusted raw name. Invalid/missing numeric values become a dash or are omitted. Zero remains zero.

All panel labels, sorting options, accessible names and compact-number units are Thai. Original character proper names remain unchanged. There is no locale switch/i18n subsystem in this project, so no unrelated localization framework was introduced.

The main meters show compact values with exact-value tooltips. Expanded details show the recorded round, exact damage only when the main value was abbreviated, and existing shield/cast counters. They omit unavailable counters and do not invent damage-type breakdowns or battle results. For example: `ความเสียหายที่ทำได้: 1,540`, `ความเสียหายที่โล่ดูดซับ: 80`, `จำนวนครั้งที่ใช้สกิล: 2`, `บันทึกจากรอบ 4`.

A labelled button controls each detail section with `aria-expanded`, `aria-controls`, visible keyboard focus and Enter/Space handling. The DOM control ID is generated locally by React, unrelated to game IDs. Labels and long names wrap; numeric values stay together. General details do not use horizontal scrolling or overflow clipping.

Regression tests cover long UUID fixtures in battle/unit/owner/match/zone/room/socket/database metadata, safe missing-round fallbacks, malformed numbers, unknown definitions, zero/fractions/millions, Thai sort options, real React DOM sorting, keyboard toggling and expanded state. `happy-dom` is a pinned **development-only** dependency for DOM tests; it does not launch a browser and is not part of the production bundle.

Validation: 130 tests passed, strict typecheck and project lint passed. Production build and diff checks are recorded in `TEST_REPORT.md`. No game/browser was launched and no manual playtest performed. DOM simulation does not verify actual browser layout or screen-reader output. No commit or push was performed.
