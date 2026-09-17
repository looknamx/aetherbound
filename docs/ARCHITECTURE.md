# Architecture and protocol v1

## Boundaries

| Path | Responsibility |
|---|---|
| `client/main.tsx`, `style.css`, `Portrait.tsx` | React HUD, lobby, forms, accessibility and original vector portraits |
| `client/Board.tsx` | Phaser canvas terrain, unit portraits and playback of server combat frames; never decides gameplay |
| `client/network.ts` | Socket.IO transport, acknowledgements, command IDs |
| `client/audio.ts` | Synthesized UI/combat tones |
| `server/app.ts` | Real-time protocol validation, per-client views, rate limits, transport/session binding |
| `server/engine.ts` | Room lifecycle, authority, finite-state machine and round resolution |
| `shared/combat.ts` | Pure deterministic fixed-step combat, BFS movement, skills, damage and item passives |
| `shared/economy.ts` | Purchase, sale, merge, equipment, XP, income and shop rolls |
| `shared/types.ts`, `protocol.ts` | Shared state model and strict Zod command schemas |
| `shared/content.ts` | Validated roster, rarity odds, traits, items and tunable rules |
| `shared/pool.ts` | Contract for a future finite room-scoped supply; not active in this release |
| `server/persistence.ts` | Completed-match archive: PostgreSQL when configured, local atomic JSON otherwise |
| `prisma/` | Schema, initial SQL migration and content seed |

React owns selection and visual preferences. The server owns gold, HP, teams, equipment, RNG, deadlines and outcomes. Phaser receives disposable snapshots; no Phaser object is persisted. JavaScript processes commands serially before broadcasting, avoiding concurrent double-spending within one server instance.

The state machine is `Lobby → Preparing → Battling → Resolving → Preparing ... → Finished`. `GameEngine.tick()` advances deadlines, cleans expired rooms and broadcasts only changes. `simulate()` computes complete immutable combat frames at battle entry. Players receive the same relevant battle payload and render according to server time. Shorter battles can finish their playback early/late relative to other pairings; all pairings resolve together at the longest duration.

For reproducibility, combat consumes a seed supplied by the room RNG. Shop and drop RNG state advances only on the server. UUID identity and cryptographic room/session secrets are intentionally not seeded gameplay randomness.

## Events

Client to server:

| Event | Payload | Ack |
|---|---|---|
| `enter` | `{name, key?}` (no key creates a room) | `{ok, key, playerId, token}` or `{ok:false,error}` |
| `resume` | 64-character session token | `{ok,key,playerId}` or error |
| `action` | `{version:1,id,action}` | `{ok:true}` or error |

`action` is a strict discriminated union: `ready`, `start`, `buy`, `sell`, `move`, `reroll`, `lock`, `xp`, `equip`, `unequip`, `dev`. Parameters and bounds are defined in `shared/protocol.ts`. Unknown fields and protocol versions are rejected. The client sends unit IDs and shop/item indices, never prices, damage, HP deltas, RNG state or resulting unit data.

Server to client:

| Event | Meaning |
|---|---|
| `state` | `{version:1,room,you,serverTime,devTools}` full authoritative resync |
| `expired` | Room is gone; client clears its session and can enter a new room |
| `replaced` | Same session resumed elsewhere; old socket is disconnected |

Tokens never enter room snapshots. Other players' shops and inventories are stripped; deployed and reserve formations remain public for scouting. A living player receives battles involving their seat; eliminated players may view all pairings. Results are published on phase resolution. Full battle outcomes are already present in playback payloads, so they are not secret until animation finishes.

## Reliability and deployment limits

- Room key: 6 cryptographic random characters from a 32-character alphabet (30 bits), collision checked. Lifetime 6 hours. Entirely disconnected rooms expire after 10 minutes of inactivity. No public directory.
- Session token: 256 cryptographic random bits. Reconnect binds a session to exactly one active socket. Tokens live only in tab session storage and server memory.
- Successful command IDs are idempotent within the latest 2,048 commands per session. Older IDs outside that bounded window are not a permanent replay ledger.
- Socket payload cap: 16 KiB. Enter: 20/min/IP. Resume: 40/min/IP. Gameplay: 40/sec/socket. Buckets age out after one minute. Multi-instance/distributed rate limiting is deferred.
- Same-origin socket handshake by default; fixed `CLIENT_ORIGIN` supported for reverse proxy deployments. Malformed Origin is rejected. No forwarded-IP trust is assumed.
- Developer tools require explicit enablement, a non-production server, a loopback socket, a loopback browser origin and host ownership. Never enable them on a public development proxy.
- Rooms are in memory; only final rankings are archived. Server restart recovery and horizontal scaling need durable room snapshots, command sequence persistence and room ownership coordination.
- Node/TypeScript backend runs with `tsx`; the production start command requires the installed development toolchain. The browser bundle is built by Vite.
- This machine has no Docker executable. The PostgreSQL schema/client generation was verified; actual PostgreSQL migrations require Docker or another PostgreSQL instance and are not represented as tested here.

## Extending finite supply

Implement `UnitPool` per room, inject it at `rollShop`, reserve offered copies, release unused offers when refreshing/unlocking, and return copies on selling/elimination. Merge must conserve copies rather than create supply. Add invariant tests for `available + offered + owned = initial supply` before enabling this rule.
