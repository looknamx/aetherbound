import { expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createGameServer } from "../server/app";
import { unit } from "./helpers";
import type { Reply, Snapshot } from "../shared/types";
const request = (s: Socket, event: string, value: unknown) =>
  new Promise<Reply>((resolve) => s.emit(event, value, resolve));
it("broadcasts identical stats, rejects invalid zones atomically, and restores latest snapshots on reconnect", async () => {
  const server = createGameServer({ archive: false }),
    port = await server.listen(0, "127.0.0.1"),
    sockets: Socket[] = [];
  const connect = async () => {
    const socket = io(`http://127.0.0.1:${port}`, {
      forceNew: true,
      transports: ["websocket"],
    });
    sockets.push(socket);
    await new Promise<void>((resolve) => socket.on("connect", resolve));
    return socket;
  };
  try {
    const a = await connect(),
      b = await connect(),
      first = await request(a, "enter", { name: "A" });
    await request(b, "enter", { name: "B", key: first.key });
    const r = server.engine.rooms.get(first.key!)!;
    server.engine.prepare(r);
    r.players[0].units = [unit("cinder", "a", 36)];
    r.players[1].units = [unit("rivet", "b", 36)];
    const before = structuredClone(r);
    const invalid = await request(a, "action", {
      version: 2,
      id: "invalid-zone-1",
      action: { type: "move", unitId: "a", slot: 0 },
    });
    expect(invalid).toMatchObject({
      ok: false,
      code: "INVALID_PLACEMENT_ZONE",
    });
    expect(r).toEqual(before);
    const read = (s: Socket) =>
      new Promise<Snapshot>((resolve) => s.once("state", resolve));
    const nextA = read(a),
      nextB = read(b);
    server.engine.battle(r);
    server.broadcast(r.key);
    const [sa, sb] = await Promise.all([nextA, nextB]);
    expect(sa.room.battles[0].stats).toEqual(sb.room.battles[0].stats);
    expect(sa.room.players[0].units[0].slot).toBeGreaterThanOrEqual(18);
    server.engine.resolve(r);
    server.engine.prepare(r);
    const latest = structuredClone(r.players[0].latestBattleStats);
    expect(latest?.units[0].unitId).toBe("a");
    const forged = await request(a, "action", {
      version: 2,
      id: "forged-stats-1",
      action: { type: "battleStats", damageDealt: 999999 },
    });
    expect(forged.ok).toBe(false);
    expect(r.players[0].latestBattleStats).toEqual(latest);
    a.disconnect();
    const restored = await connect(),
      sync = read(restored);
    expect((await request(restored, "resume", first.token)).ok).toBe(true);
    const state = await sync;
    expect(state.room.players[0].latestBattleStats).toEqual(latest);
    expect(state.room.players[0].units[0].slot).toBeGreaterThanOrEqual(18);
    expect(JSON.parse(JSON.stringify(latest))).toEqual(latest);
  } finally {
    for (const s of sockets) s.disconnect();
    await server.close();
  }
});
