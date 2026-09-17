import { expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createGameServer } from "../server/app";
import { unit } from "./helpers";
import type { Reply, Snapshot } from "../shared/types";
const request = (socket: Socket, event: string, value: unknown) =>
  new Promise<Reply>((resolve) => socket.emit(event, value, resolve));
it("two sockets receive identical deployed boards and reconnect restores them; forged deployment and late moves are rejected", async () => {
  const server = createGameServer({ archive: false }),
    port = await server.listen(0, "127.0.0.1"),
    sockets: Socket[] = [];
  const connect = async () => {
    const s = io(`http://127.0.0.1:${port}`, {
      forceNew: true,
      transports: ["websocket"],
    });
    sockets.push(s);
    await new Promise<void>((resolve) => s.on("connect", resolve));
    return s;
  };
  try {
    const a = await connect(),
      b = await connect();
    const first = await request(a, "enter", { name: "A" });
    await request(b, "enter", { name: "B", key: first.key });
    const room = server.engine.rooms.get(first.key!)!;
    server.engine.prepare(room);
    const p = room.players[0];
    p.level = 4;
    p.units = [
      unit("cinder", "front", 2),
      unit("brook", "back", 32),
      unit("solara", "legend", 36, 1, ["sunshard"]),
      unit("rivet", "reserve-tank", 37),
      unit("lumen", "reserve-range", 38),
    ];
    const forged = await request(a, "action", {
      version: 1,
      id: "forged-deploy",
      action: { type: "autoDeploy", units: [{ id: "fake", slot: 3 }] },
    });
    expect(forged.ok).toBe(false);
    const nextA = new Promise<Snapshot>((resolve) => a.once("state", resolve)),
      nextB = new Promise<Snapshot>((resolve) => b.once("state", resolve));
    room.deadline = Date.now() - 1;
    server.engine.tick();
    server.broadcast(room.key);
    const [sa, sb] = await Promise.all([nextA, nextB]);
    expect(sa.room.phase).toBe("Battling");
    expect(sa.room.players[0].units).toEqual(sb.room.players[0].units);
    expect(sa.room.players[0].units.filter((u) => u.slot < 36)).toHaveLength(4);
    expect(sa.room.deployments).toEqual(sb.room.deployments);
    expect(sa.room.battles).toEqual(sb.room.battles);
    expect(sa.room.deployments![0].moves.map((m) => m.unitId)).toEqual([
      "legend",
      "reserve-tank",
    ]);
    expect(
      (
        await request(a, "action", {
          version: 1,
          id: "late-move-99",
          action: { type: "move", unitId: "reserve-range", slot: 4 },
        })
      ).ok,
    ).toBe(false);
    a.disconnect();
    const restored = await connect(),
      sync = new Promise<Snapshot>((resolve) =>
        restored.once("state", resolve),
      );
    expect((await request(restored, "resume", first.token)).ok).toBe(true);
    const snapshot = await sync;
    expect(snapshot.room.players[0].units).toEqual(sa.room.players[0].units);
    expect(snapshot.room.deployments).toEqual(sa.room.deployments);
    expect(snapshot.autoDeployPreview).toEqual([]);
  } finally {
    for (const s of sockets) s.disconnect();
    await server.close();
  }
});
