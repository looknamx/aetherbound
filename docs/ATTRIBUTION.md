# Assets and references

- World, names, lore, skill names, CSS island, portrait SVGs and Phaser geometry: original work for Aetherbound. Replace portraits at `client/Portrait.tsx` and actor drawing at `client/Board.tsx`.
- Sounds: synthesized sine/triangle tones in `client/audio.ts`; no sampled recordings.
- Cormorant Garamond and DM Sans are bundled locally through Fontsource. Their SIL Open Font License files are included in the installed `@fontsource/*` packages. No Google Fonts network request is made during gameplay.
- Framework packages retain their respective licenses in `node_modules`. Dependency versions and hashes are fixed by `package-lock.json`.
- Phaser input conventions were checked against the [official Phaser 3 input documentation](https://docs.phaser.io/api-documentation/3.90.0/class/input-inputmanager). Realtime transport uses [Socket.IO v4](https://socket.io/docs/v4/).

No Dota characters, names, icons, audio, UI artwork or other game assets are included.
