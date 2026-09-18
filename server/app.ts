import express from "express";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Server } from "socket.io";
import { GameEngine, type Session } from "./engine";
import { archiveMatch } from "./persistence";
import { enterSchema, envelopeSchema } from "../shared/protocol";
import type { Reply, Snapshot } from "../shared/types";
import { previewAutoDeploy, repairFormation } from "../shared/autoDeploy";
import { PlacementError } from "../shared/deploymentZone";
export function createGameServer(
  options: { devTools?: boolean; archive?: boolean } = {},
) {
  const app = express(),
    http = createServer(app);
  const io = new Server(http, {
    maxHttpBufferSize: 16384,
    cors: process.env.CLIENT_ORIGIN
      ? { origin: process.env.CLIENT_ORIGIN }
      : undefined,
    allowRequest: (req, done) => {
      const origin = req.headers.origin;
      const expected = process.env.CLIENT_ORIGIN;
      try {
        done(
          null,
          !origin ||
            (!!expected && origin === expected) ||
            (!expected && new URL(origin).host === req.headers.host),
        );
      } catch {
        done(null, false);
      }
    },
  });
  const engine = new GameEngine((r) => {
    if (options.archive !== false)
      void archiveMatch(r).catch((e) =>
        console.error("Match archive failed:", e.message),
      );
  });
  const bound = new Map<string, Session>();
  const sessionsSockets = new Map<string, string>();
  const rates = new Map<string, { count: number; at: number }>();
  const allow = (key: string, limit: number, ms: number) => {
    const now = Date.now();
    let r = rates.get(key);
    if (!r || now - r.at > ms) {
      r = { count: 0, at: now };
      rates.set(key, r);
    }
    if (++r.count > limit) throw Error("Too many requests. Please wait.");
  };
  const isDev = (socket: import("socket.io").Socket) =>
    !!options.devTools &&
    process.env.NODE_ENV !== "production" &&
    (!socket.handshake.headers.origin ||
      /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(
        socket.handshake.headers.origin,
      )) &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(socket.handshake.address);
  function broadcast(key: string) {
    const room = engine.rooms.get(key);
    // Normalize legacy formations before any resync; never modify combat-frame coordinates.
    if (room && room.players.reduce((n, p) => n + repairFormation(p), 0) > 0)
      engine.touch(room);
    for (const [socketId, s] of bound) {
      if (s.key !== key) continue;
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      if (!room) {
        bound.delete(socketId);
        sessionsSockets.delete(s.token);
        socket.emit("expired");
        continue;
      }
      const own = room.players.find((p) => p.id === s.playerId)!;
      const safe = {
        ...room,
        players: room.players.map((p) =>
          p.id === s.playerId ? p : { ...p, shop: [], inventory: [] },
        ),
        battles: room.battles.filter(
          (b) => b.a === own.id || b.b === own.id || own.hp === 0,
        ),
      };
      socket.emit("state", {
        version: 1,
        room: safe,
        you: s.playerId,
        serverTime: Date.now(),
        devTools: isDev(socket),
        autoDeployPreview:
          room.phase === "Preparing" && own.hp > 0
            ? previewAutoDeploy(own)
            : [],
      } satisfies Snapshot);
    }
  }
  function bind(socket: import("socket.io").Socket, s: Session) {
    const previous = sessionsSockets.get(s.token);
    if (previous && previous !== socket.id) {
      bound.delete(previous);
      io.sockets.sockets.get(previous)?.emit("replaced");
      io.sockets.sockets.get(previous)?.disconnect(true);
    }
    bound.set(socket.id, s);
    sessionsSockets.set(s.token, socket.id);
    broadcast(s.key);
  }
  io.on("connection", (socket) => {
    const handle = (cb: unknown, fn: () => Reply) => {
      try {
        const result = fn();
        if (typeof cb === "function") cb(result);
      } catch (e) {
        if (typeof cb === "function")
          cb({
            ok: false,
            code: e instanceof PlacementError ? e.code : undefined,
            error: e instanceof Error ? e.message : "Invalid request.",
          });
      }
    };
    socket.on("enter", (payload, cb) =>
      handle(cb, () => {
        allow(`enter:${socket.handshake.address}`, 20, 60000);
        if (bound.has(socket.id)) throw Error("Already in a room.");
        const parsed = enterSchema.safeParse(payload);
        if (!parsed.success)
          throw Error(
            "Enter a name (1–24 characters) and a valid 6-character room key.",
          );
        const { key, name } = parsed.data;
        const s = key ? engine.join(key, name) : engine.create(name);
        bind(socket, s);
        return { ok: true, key: s.key, token: s.token, playerId: s.playerId };
      }),
    );
    socket.on("resume", (token, cb) =>
      handle(cb, () => {
        allow(`resume:${socket.handshake.address}`, 40, 60000);
        if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
          throw Error("Invalid session.");
        const current = bound.get(socket.id);
        if (current && current.token !== token)
          throw Error("Already in a room.");
        const s = engine.reconnect(token);
        bind(socket, s);
        return { ok: true, key: s.key, playerId: s.playerId };
      }),
    );
    socket.on("action", (payload, cb) =>
      handle(cb, () => {
        allow(`action:${socket.id}`, 40, 1000);
        const s = bound.get(socket.id);
        if (!s) throw Error("Join a room first.");
        const parsed = envelopeSchema.safeParse(payload);
        if (!parsed.success)
          throw Error("Invalid action schema or protocol version.");
        engine.action(s, parsed.data.id, parsed.data.action, isDev(socket));
        broadcast(s.key);
        return { ok: true };
      }),
    );
    socket.on("disconnect", () => {
      const s = bound.get(socket.id);
      bound.delete(socket.id);
      if (s && sessionsSockets.get(s.token) === socket.id) {
        sessionsSockets.delete(s.token);
        engine.disconnect(s);
        broadcast(s.key);
      }
    });
  });
  const timer = setInterval(() => {
    for (const key of engine.tick()) broadcast(key);
    for (const [key, rate] of rates)
      if (Date.now() - rate.at > 60000) rates.delete(key);
  }, 100);
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, protocol: 1, rooms: engine.rooms.size }),
  );
  app.use(express.static(resolve("dist")));
  app.get("*", (_req, res) => res.sendFile(resolve("dist/index.html")));
  return {
    app,
    http,
    io,
    engine,
    broadcast,
    close: async () => {
      clearInterval(timer);
      await new Promise<void>((r) => io.close(() => r()));
    },
    listen: (port = 3001, host = "0.0.0.0") =>
      new Promise<number>((r) =>
        http.listen(port, host, () =>
          r((http.address() as { port: number }).port),
        ),
      ),
  };
}
