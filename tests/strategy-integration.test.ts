import { expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createGameServer } from "../server/app";
import { simulateBots } from "../server/headless";
import { GameEngine } from "../server/engine";
import { scoutingView, roomView } from "../server/views";
import { perceiveBot } from "../server/bots";
import { assertPool } from "../shared/pool";
import { migrateRoom } from "../shared/migration";
import { unit } from "./helpers";
import type { Reply, Snapshot } from "../shared/types";
it("a fresh connection can start practice after a completed bound match", async () => {
  const server = createGameServer({ archive: false }),
    port = await server.listen(0, "127.0.0.1"),
    s = io("http://127.0.0.1:" + port, {
      autoConnect: false,
      forceNew: true,
      transports: ["websocket"],
    });
  const connect = () =>
    new Promise<void>((resolve) => {
      s.once("connect", resolve);
      s.connect();
    });
  const request = (event: string, data: unknown) =>
    new Promise<Reply>((resolve) => s.emit(event, data, resolve));
  try {
    await connect();
    const first = await request("practice", {
      name: "Replay",
      difficulty: "hard",
    });
    expect(first.ok).toBe(true);
    const old = [...server.engine.rooms.values()][0];
    old.phase = "Finished";
    expect(
      (await request("practice", { name: "Replay", difficulty: "hard" })).ok,
    ).toBe(false);
    s.disconnect();
    await connect();
    const second = await request("practice", {
      name: "Replay",
      difficulty: "hard",
    });
    expect(second.ok).toBe(true);
    expect(second.token).not.toBe(first.token);
    const next = [...server.engine.rooms.values()].find(
      (r) => r.key !== old.key,
    )!;
    expect(next.phase).toBe("Preparing");
    expect(next.round).toBe(1);
    expect(next.players[0].hp).toBe(100);
    expect(
      next.players
        .filter((p) => p.bot)
        .every((p) => p.bot?.difficulty === "hard"),
    ).toBe(true);
  } finally {
    s.disconnect();
    await server.close();
  }
});
it("headless bot matches replay identically and finish with conserved supply", () => {
  const a = simulateBots(31),
    b = simulateBots(31);
  expect(a).toEqual(b);
  expect(a.placements.map((p) => p.rank).sort()).toEqual([1, 2, 3, 4]);
  expect(Object.keys(a.itemSelections).length).toBeGreaterThan(0);
  expect(Object.keys(a.augmentSelections).length).toBeGreaterThan(0);
});
it("scouting and bot perceptions expose only public opponent information", () => {
  const engine = new GameEngine(),
    s = engine.create("Own");
  engine.join(s.key, "Opponent");
  const r = engine.rooms.get(s.key)!,
    p = r.players[1];
  p.units = [
    unit("cinder", "board-private-id", 18),
    unit("brook", "bench-private-id", 36),
  ];
  p.inventory = ["sunshard"];
  p.pendingChoices = {
    item: { round: 1, options: ["sunshard", "heartglass", "moonwell"] },
  };
  p.rewardOverflow = ["sunshard"];
  const view = scoutingView(p, 1);
  expect(view.units).toHaveLength(1);
  expect(JSON.stringify(view)).not.toMatch(
    /private-id|inventory|pendingChoices|seed|gold|shop|rewardOverflow/,
  );
  const safe = roomView(r, s.playerId);
  expect(safe).not.toHaveProperty("seed");
  expect(safe).not.toHaveProperty("pool");
  expect(safe.players[1].units).toHaveLength(1);
  expect(safe.players[1]).not.toHaveProperty("pendingChoices");
  expect(perceiveBot(r, r.players[0]).opponents).toEqual([scoutingView(p, 0)]);
});
it("restored practice bots retain sessions and incompatible bonuses are rejected", () => {
  const engine = new GameEngine(),
    s = engine.practice("Own", "hard"),
    r = engine.rooms.get(s.key)!;
  const restored = new GameEngine();
  const copy = restored.restoreRoom(r);
  expect(restored.sessions.size).toBe(3);
  assertPool(copy);
  copy.players[0].augments = ["stipend", "resolve"];
  expect(() => migrateRoom(copy)).toThrow(/Conflicting/);
});
it("practice socket restores private choices and rejects old protocol and opponent ownership", async () => {
  const server = createGameServer({ archive: false }),
    port = await server.listen(0, "127.0.0.1"),
    sockets: Socket[] = [];
  const connect = async () => {
    const s = io("http://127.0.0.1:" + port, {
      forceNew: true,
      transports: ["websocket"],
    });
    sockets.push(s);
    await new Promise<void>((resolve) => s.once("connect", resolve));
    return s;
  };
  const request = (s: Socket, event: string, data: unknown) =>
    new Promise<Reply>((resolve) => s.emit(event, data, resolve));
  try {
    const s = await connect();
    const initial = new Promise<Snapshot>((resolve) =>
      s.once("state", resolve),
    );
    const reply = await request(s, "practice", {
      name: "Practice",
      difficulty: "normal",
    });
    expect(reply.ok).toBe(true);
    const snapshot = await initial,
      r = server.engine.rooms.get(snapshot.room.key)!;
    expect(r.players.filter((p) => p.bot)).toHaveLength(3);
    expect(r.phase).toBe("Preparing");
    expect(
      (
        await request(s, "action", {
          version: 1,
          id: "old-protocol",
          action: { type: "reroll" },
        })
      ).ok,
    ).toBe(false);
    const enemy = r.players.find((p) => p.bot && p.units.length)!;
    expect(
      (
        await request(s, "action", {
          version: 2,
          id: "enemy-move",
          action: { type: "move", unitId: enemy.units[0].id, slot: 30 },
        })
      ).ok,
    ).toBe(false);
    r.phase = "Choosing";
    r.deadline = Date.now() + 20000;
    r.players[0].pendingChoices = {
      item: { round: r.round, options: ["sunshard", "heartglass", "moonwell"] },
    };
    s.disconnect();
    const resumed = await connect(),
      next = new Promise<Snapshot>((resolve) => resumed.once("state", resolve));
    expect((await request(resumed, "resume", reply.token)).ok).toBe(true);
    const state = await next;
    expect(state.room.players[0].pendingChoices).toEqual(
      r.players[0].pendingChoices,
    );
    expect(state.room.players.slice(1).every((p) => !p.pendingChoices)).toBe(
      true,
    );
    expect(state.scouting?.length).toBe(4);
  } finally {
    for (const s of sockets) s.disconnect();
    await server.close();
  }
});
