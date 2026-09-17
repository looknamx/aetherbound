import { afterEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createGameServer } from "../server/app";
import { GameEngine } from "../server/engine";
import type { Reply, Snapshot } from "../shared/types";
const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => {
  for (const f of cleanup.reverse()) await f();
  cleanup.length = 0;
});
const emit = (s: Socket, event: string, data: unknown) =>
  new Promise<Reply>((resolve) => s.emit(event, data, resolve));
describe("authoritative rooms", () => {
  it("requires ready players and a host; rejects invalid phase, ownership and duplicate spending", () => {
    const e = new GameEngine(),
      a = e.create("A"),
      b = e.join(a.key, "B"),
      r = e.rooms.get(a.key)!;
    expect(() => e.action(b, "start-b", { type: "start" })).toThrow();
    expect(() => e.action(a, "start-a", { type: "start" })).toThrow();
    e.action(a, "ready-a", { type: "ready", ready: true });
    e.action(b, "ready-b", { type: "ready", ready: true });
    e.action(a, "start-ok", { type: "start" });
    expect(r.phase).toBe("Preparing");
    e.action(a, "buy-once", { type: "buy", index: 0 });
    const gold = r.players[0].gold;
    e.action(a, "buy-once", { type: "buy", index: 0 });
    expect(r.players[0].gold).toBe(gold);
    expect(() =>
      e.action(b, "steal", { type: "sell", unitId: r.players[0].units[0].id }),
    ).toThrow();
    e.battle(r);
    expect(() => e.action(a, "battle-buy", { type: "buy", index: 1 })).toThrow(
      "preparation",
    );
  });
  it("preserves locked shops, finishes draws with unique rankings and cleans expired rooms", () => {
    const e = new GameEngine(),
      a = e.create("A"),
      b = e.join(a.key, "B"),
      r = e.rooms.get(a.key)!;
    for (const s of [a, b])
      e.action(s, s.playerId, { type: "ready", ready: true });
    e.action(a, "start", { type: "start" });
    e.action(a, "lock", { type: "lock" });
    const shop = [...r.players[0].shop];
    e.battle(r);
    e.resolve(r);
    e.prepare(r);
    expect(r.players[0].shop).toEqual(shop);
    let loops = 0;
    while (r.phase !== "Finished" && loops++ < 100) {
      e.battle(r);
      e.resolve(r);
      if (String(r.phase) !== "Finished") e.prepare(r);
    }
    expect(r.phase).toBe("Finished");
    expect(r.players.map((p) => p.rank).sort()).toEqual([1, 2]);
    e.tick(r.createdAt + 7 * 60 * 60 * 1000);
    expect(e.rooms.size).toBe(0);
    expect(e.sessions.size).toBe(0);
  });
  it("handles 3-player ghost rounds and 4-player rounds until one winner remains", () => {
    for (const count of [3, 4]) {
      const e = new GameEngine(),
        a = e.create("A");
      const sessions = [
        a,
        ...Array.from({ length: count - 1 }, (_, i) => e.join(a.key, `P${i}`)),
      ];
      const r = e.rooms.get(a.key)!;
      for (const s of sessions)
        e.action(s, s.playerId, { type: "ready", ready: true });
      e.action(a, "start", { type: "start" });
      let loops = 0;
      while (r.phase !== "Finished" && loops++ < 100) {
        e.battle(r);
        if (count === 3 && loops === 1)
          expect(r.battles.some((b) => b.ghost)).toBe(true);
        e.resolve(r);
        if (String(r.phase) !== "Finished") e.prepare(r);
      }
      expect(r.phase).toBe("Finished");
      expect(new Set(r.players.map((p) => p.rank)).size).toBe(count);
      expect(r.players.filter((p) => p.rank === 1)).toHaveLength(1);
    }
  });
  it("transfers host on disconnect and restores the original player state", () => {
    const e = new GameEngine(),
      a = e.create("A"),
      b = e.join(a.key, "B"),
      r = e.rooms.get(a.key)!;
    r.players[0].gold = 87;
    e.disconnect(a);
    expect(r.hostId).toBe(b.playerId);
    expect(e.reconnect(a.token).playerId).toBe(a.playerId);
    expect(r.players[0].gold).toBe(87);
    expect(() => e.reconnect("bogus")).toThrow();
  });
  it("uses real Socket.IO clients, validates schema, hides tokens/shops, reconnects and finishes a match", async () => {
    const srv = createGameServer({ archive: false }),
      port = await srv.listen(0, "127.0.0.1");
    cleanup.push(() => srv.close());
    const sockets: Socket[] = [];
    const connect = async () => {
      const s = io(`http://127.0.0.1:${port}`, {
        transports: ["websocket"],
        forceNew: true,
      });
      await new Promise<void>((resolve) => s.on("connect", resolve));
      sockets.push(s);
      return s;
    };
    cleanup.push(() => sockets.forEach((s) => s.disconnect()));
    const a = await connect(),
      b = await connect();
    let sa: Snapshot | undefined, sb: Snapshot | undefined;
    a.on("state", (s) => (sa = s));
    b.on("state", (s) => (sb = s));
    const ar = await emit(a, "enter", { name: "A" });
    expect(ar.ok).toBe(true);
    expect((await emit(b, "enter", { name: "B", key: ar.key })).ok).toBe(true);
    const action = (s: Socket, id: string, action: unknown) =>
      emit(s, "action", { version: 1, id, action });
    expect((await action(a, "bad-schema", { type: "buy", index: -1 })).ok).toBe(
      false,
    );
    expect(
      (await action(a, "bad-dev-0", { type: "dev", command: "gold" })).ok,
    ).toBe(false);
    await action(a, "ready-aaa", { type: "ready", ready: true });
    await action(b, "ready-bbb", { type: "ready", ready: true });
    await action(a, "start-aaa", { type: "start" });
    await new Promise((r) => setTimeout(r, 30));
    expect(sa!.room.phase).toBe("Preparing");
    expect(sa!.room.players.find((p) => p.id !== sa!.you)!.shop).toEqual([]);
    expect(JSON.stringify(sa)).not.toContain(ar.token!);
    a.disconnect();
    const a2 = await connect();
    expect((await emit(a2, "resume", ar.token)).ok).toBe(true);
    const room = srv.engine.rooms.get(ar.key!)!;
    let loops = 0;
    while (room.phase !== "Finished" && loops++ < 100) {
      srv.engine.battle(room);
      srv.engine.resolve(room);
      if (String(room.phase) !== "Finished") srv.engine.prepare(room);
    }
    srv.broadcast(room.key);
    await new Promise((r) => setTimeout(r, 30));
    expect(sb!.room.phase).toBe("Finished");
    expect(sb!.room.players.filter((p) => p.rank === 1)).toHaveLength(1);
  });
});
