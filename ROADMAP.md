# Remaining work and limits

## Before public production

- Durable snapshots for running rooms, session recovery across server restarts, Redis-backed room ownership and distributed rate limits. Current reconnect covers browser/network interruption while the process remains alive.
- Load tests, socket connection limits, worker-thread combat for larger room counts, operational metrics and archive failure retries. Current simulation is synchronous and bounded for 2–4-player MVP rooms.
- Actual PostgreSQL migration/seed integration test in an environment with PostgreSQL/Docker. Local JSON match archival is the tested default.
- Deploy behind HTTPS/WebSocket reverse proxy and configure public origin. There is no hosted public URL from this task.
- Review dependency overrides (`deepmerge-ts`, `effect`) when upgrading Prisma; currently client generation and build pass with patched overrides.

## Gameplay and polish

- Finite shared unit pool. Independent shop rolls are intentional in this MVP. `shared/pool.ts` documents the implementation seam and copy-conservation contract.
- Longer balance/playtesting sessions for all 18 recruits, scaling, interest and matchup distribution. Distinct roles and effects exist, but competitive balance is not established.
- Preserve all 36 preparation positions without compression through a larger combat arena or simultaneous attack/defend boards. Current 6-row → 3-row mapping is documented in the field guide and rules.
- Better crowded-path target fallback and richer positioning decisions. Current deterministic BFS can time out against blocked targets; timeout rules still finish the round.
- Purpose-drawn animated sprites, richer VFX and music. Current original geometric placeholders show movement, attack/cast beams, health loss, status, death markers, merge notices and UI/combat tones.
- Per-player spectating controls and rematch within the same room. Eliminated players currently watch the first available pairing; New expedition creates a fresh room.
- Thai localization. Current game UI uses English; setup instructions are in Thai.
- Device testing on physical Android/iOS hardware. Automated touch emulation and desktop browser checks do not replace this.
- Permanent command sequence ledger beyond the current 2,048-ID idempotency window.

## Optional scope

Accounts, public matchmaking, chat, bots, ranked play, cosmetics, replay files, item crafting, PVE events and moderation tools are not part of this private-room MVP.
