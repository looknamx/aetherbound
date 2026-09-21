import {
  initializePool,
  pooledShop,
  assertPool,
  releaseShop,
  reserve,
  returnUnit,
  eliminateSupply,
} from "../shared/pool";
import { offerChoices, choose, drainRewards } from "../shared/choices";
import { incomeBreakdown, combatSummary } from "../shared/roundInsights";
import { STRATEGY, DIFFICULTY, augmentValue } from "../shared/strategyConfig";
import { migrateRoom } from "../shared/migration";
import { planBot } from "./bots";
import type { Difficulty } from "../shared/strategyTypes";
import { randomBytes, randomUUID } from "node:crypto";
import { ITEMS, RULES, UNIT_MAP } from "../shared/content";
import { addXP, buy, equip, mergeUnits, move, sell } from "../shared/economy";
import { simulate } from "../shared/combat";
import { RNG } from "../shared/random";
import { autoDeploy, repairFormation } from "../shared/autoDeploy";
import type { Action, Player, Room } from "../shared/types";
export interface Session {
  token: string;
  playerId: string;
  key: string;
  seen: Set<string>;
}
export class GameEngine {
  rooms = new Map<string, Room>();
  sessions = new Map<string, Session>();
  speeds = new Map<string, number>();
  constructor(
    public onFinish: (room: Room) => void = () => {},
    public now: () => number = Date.now,
    private identity: () => string = randomUUID,
  ) {}
  create(name: string) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let key: string;
    do {
      key = Array.from(
        randomBytes(6),
        (b) => alphabet[b % alphabet.length],
      ).join("");
    } while (this.rooms.has(key));
    const now = this.now();
    this.rooms.set(key, {
      key,
      hostId: "",
      phase: "Lobby",
      round: 0,
      deadline: 0,
      seed: randomBytes(4).readUInt32LE(),
      players: [],
      battles: [],
      createdAt: now,
      updatedAt: now,
      revision: 0,
    });
    const session = this.join(key, name);
    const room = this.rooms.get(key)!;
    room.schemaVersion = 2;
    room.mode = "multiplayer";
    initializePool(room);
    return session;
  }
  join(key: string, name: string) {
    const r = this.rooms.get(key);
    if (!r || this.now() - r.createdAt > RULES.roomTtlMs)
      throw Error("Room not found or expired.");
    if (r.phase !== "Lobby") throw Error("This match has already started.");
    if (r.players.length >= 4) throw Error("This room is full.");
    const id = this.identity(),
      token = randomBytes(32).toString("hex");
    const p: Player = {
      id,
      name,
      connected: true,
      ready: false,
      hp: 100,
      gold: RULES.startGold,
      level: 2,
      xp: 0,
      shop: [],
      locked: false,
      units: [],
      inventory: ["sunshard"],
      streak: 0,
      augments: [],
      pendingChoices: {},
      rewardOverflow: [],
    };
    r.players.push(p);
    if (!r.hostId) r.hostId = id;
    const session = { token, playerId: id, key, seen: new Set<string>() };
    this.sessions.set(token, session);
    this.touch(r);
    return session;
  }
  touch(r: Room) {
    r.revision++;
    r.updatedAt = this.now();
  }
  reconnect(token: string) {
    const s = this.sessions.get(token);
    if (!s || !this.rooms.has(s.key))
      throw Error("Session expired. Create or join a room.");
    const r = this.rooms.get(s.key)!;
    r.players.find((p) => p.id === s.playerId)!.connected = true;
    for (const p of r.players) repairFormation(p);
    if (!r.players.some((p) => p.id === r.hostId && p.connected && !p.bot))
      r.hostId = s.playerId;
    this.touch(r);
    return s;
  }
  disconnect(s: Session) {
    const r = this.rooms.get(s.key);
    if (!r) return;
    const p = r.players.find((p) => p.id === s.playerId)!;
    p.connected = false;
    if (r.phase === "Lobby") p.ready = false;
    if (r.hostId === p.id)
      r.hostId = r.players.find((x) => x.connected && !x.bot)?.id ?? p.id;
    this.touch(r);
  }
  rng(r: Room) {
    const rng = new RNG(r.seed);
    return rng;
  }
  action(s: Session, id: string, action: Action, dev = false) {
    const r = this.rooms.get(s.key);
    if (!r) throw Error("Room expired.");
    if (s.seen.has(id)) return;
    const p = r.players.find((p) => p.id === s.playerId)!;
    if (action.type === "ready") {
      if (r.phase !== "Lobby")
        throw Error("Ready is only available in the lobby.");
      p.ready = action.ready;
    } else if (action.type === "start") {
      if (r.phase !== "Lobby" || p.id !== r.hostId)
        throw Error("Only the host may start a lobby.");
      if (
        r.players.length < 2 ||
        !r.players.every((p) => p.ready && p.connected)
      )
        throw Error(
          "At least 2 players must be connected and everyone must be ready.",
        );
      this.prepare(r);
    } else if (action.type === "choose") {
      if (r.phase !== "Choosing" || p.hp <= 0 || this.now() >= r.deadline)
        throw Error("Choice phase has ended.");
      choose(p, action.kind, action.round, action.index);
    } else if (action.type === "dev") {
      if (!dev || p.id !== r.hostId)
        throw Error("Developer tools are disabled.");
      this.debug(r, p, action);
    } else {
      if (
        r.phase !== "Preparing" ||
        p.hp <= 0 ||
        (r.deadline > 0 && this.now() >= r.deadline)
      )
        throw Error("You can only change your team during preparation.");
      const rng = this.rng(r);
      switch (action.type) {
        case "buy":
          if (!p.shop[action.index]) throw Error("No reserved offer.");
          assertPool(r);
          buy(p, action.index, this.identity());
          assertPool(r);
          break;
        case "sell":
          {
            const owned = p.units.find((u) => u.id === action.unitId);
            if (!owned) throw Error("Unit not found.");
            sell(p, action.unitId);
            returnUnit(r, owned);
          }
          break;
        case "move":
          move(p, action.unitId, action.slot);
          break;
        case "equip":
          equip(p, action.unitId, action.itemIndex);
          break;
        case "unequip":
          equip(p, action.unitId, action.itemIndex, true);
          break;
        case "reroll":
          if (p.gold < this.rerollCost(p)) throw Error("Not enough gold.");
          p.gold -= this.rerollCost(p);
          pooledShop(r, p, rng);
          break;
        case "lock":
          p.locked = !p.locked;
          break;
        case "xp":
          if (p.level >= RULES.maxLevel) throw Error("Maximum level reached.");
          if (p.gold < RULES.xpCost) throw Error("Not enough gold.");
          p.gold -= RULES.xpCost;
          addXP(p, RULES.xpAmount);
          break;
      }
      r.seed = rng.state >>> 0;
    }
    drainRewards(p);
    s.seen.add(id);
    if (s.seen.size > 2048) s.seen.delete(s.seen.values().next().value!);
    this.touch(r);
  }
  prepare(r: Room) {
    r.phase = "Preparing";
    r.round++;
    r.battles = [];
    const rng = this.rng(r);
    for (const p of r.players.filter((p) => p.hp > 0)) {
      repairFormation(p);
      drainRewards(p);
      if (!p.locked) pooledShop(r, p, rng);
    }
    r.seed = rng.state >>> 0;
    r.deadline = this.now() + RULES.prepMs / (this.speeds.get(r.key) ?? 1);
    this.runBots(r);
  }
  battle(r: Room) {
    if (r.phase !== "Preparing") return;
    // Close preparation first. All work below is synchronous: no action can interleave.
    r.phase = "Battling";
    const active = r.players.filter((p) => p.hp > 0);
    r.deployments = active.map((p) => ({
      id: `${r.key}:${r.round}:${p.id}`,
      playerId: p.id,
      round: r.round,
      at: this.now(),
      ...autoDeploy(p),
    }));
    const rotation = r.round % active.length;
    const ordered = [...active.slice(rotation), ...active.slice(0, rotation)];
    r.battles = [];
    const rng = this.rng(r);
    for (let i = 0; i < ordered.length; i += 2) {
      const a = ordered[i],
        b = ordered[i + 1] ?? ordered[0];
      r.battles.push(
        simulate(
          a,
          b,
          Math.floor(rng.next() * 0xffffffff),
          !ordered[i + 1],
          r.round,
        ),
      );
    }
    r.seed = rng.state >>> 0;
    const startedAt = this.now(),
      playbackRate = this.speeds.get(r.key) ?? 1;
    for (const battle of r.battles) {
      battle.startedAt = startedAt;
      battle.playbackRate = playbackRate;
    }
    r.deadline =
      this.now() +
      Math.max(...r.battles.map((b) => b.duration)) /
        (this.speeds.get(r.key) ?? 1);
  }
  resolve(r: Room) {
    r.phase = "Resolving";
    for (const p of r.players) {
      const battle = r.battles.find(
        (b) => b.a === p.id || (b.b === p.id && !b.ghost),
      );
      if (battle?.stats)
        p.latestBattleStats = structuredClone({
          ...battle.stats,
          units: battle.stats.units.filter((u) => u.ownerId === p.id),
        });
    }
    const outcomes = new Map<string, { win: boolean | null; damage: number }>();
    for (const b of r.battles) {
      const pressure = 2 + Math.floor(r.round / 3);
      const damage = pressure + b.damage;
      if (b.winner === null) {
        outcomes.set(b.a, { win: null, damage: pressure });
        if (!b.ghost) outcomes.set(b.b, { win: null, damage: pressure });
      } else {
        outcomes.set(b.a, {
          win: b.winner === 0,
          damage: b.winner === 0 ? 0 : damage,
        });
        if (!b.ghost)
          outcomes.set(b.b, {
            win: b.winner === 1,
            damage: b.winner === 1 ? 0 : damage,
          });
      }
    }
    const rng = this.rng(r);
    for (const p of r.players.filter((p) => p.hp > 0)) {
      const result = outcomes.get(p.id);
      if (!result) continue;
      p.hp = Math.max(0, p.hp - result.damage);
      p.streak =
        result.win === null
          ? 0
          : result.win
            ? Math.max(0, p.streak) + 1
            : Math.min(0, p.streak) - 1;
      p.latestIncome = incomeBreakdown(p, result.win, r.round);
      const earned = p.latestIncome.total;
      p.gold = p.latestIncome.after;
      const played = r.battles.find(
        (b) => b.a === p.id || (b.b === p.id && !b.ghost),
      );
      if (played) {
        const enemy = r.players.find(
          (x) => x.id === (played.a === p.id ? played.b : played.a),
        )!;
        p.latestSummary = combatSummary(
          played,
          p,
          enemy,
          result.win,
          result.damage,
          r.round,
        );
      }
      addXP(p, 2);
      p.lastResult = `${result.win === null ? "Draw" : result.win ? "Victory" : "Defeat"} · ${result.damage ? `−${result.damage} HP · ` : ""}+${earned} gold`;
    }
    r.seed = rng.state >>> 0;
    const newlyOut = r.players
      .filter((p) => p.hp === 0 && !p.rank)
      .sort((a, b) => a.gold - b.gold || a.id.localeCompare(b.id));
    let rank = r.players.filter((p) => !p.rank).length;
    for (const p of newlyOut) {
      p.rank = rank--;
      eliminateSupply(r, p);
    }
    const remaining = r.players.filter((p) => p.hp > 0);
    if (remaining.length <= 1) {
      if (remaining[0]) remaining[0].rank = 1;
      r.phase = "Finished";
      r.deadline = 0;
      this.onFinish(structuredClone(r));
    } else
      r.deadline = this.now() + RULES.resultMs / (this.speeds.get(r.key) ?? 1);
  }
  tick(now = this.now()) {
    const changed: string[] = [];
    for (const r of this.rooms.values()) {
      if (
        now - r.createdAt > RULES.roomTtlMs ||
        (!r.players.some((p) => p.connected && !p.bot) &&
          now - r.updatedAt > RULES.emptyTtlMs)
      ) {
        this.rooms.delete(r.key);
        this.speeds.delete(r.key);
        for (const [token, s] of this.sessions)
          if (s.key === r.key) this.sessions.delete(token);
        changed.push(r.key);
        continue;
      }
      if (
        r.phase === "Choosing" &&
        r.players.every(
          (p) => !p.pendingChoices?.item && !p.pendingChoices?.augment,
        )
      ) {
        this.prepare(r);
        r.revision++;
        changed.push(r.key);
        continue;
      }
      if (r.deadline && now >= r.deadline) {
        if (r.phase === "Preparing") this.battle(r);
        else if (r.phase === "Battling") this.resolve(r);
        else if (r.phase === "Resolving") this.beginChoices(r);
        else if (r.phase === "Choosing") this.finishChoices(r);
        r.revision++;
        changed.push(r.key);
      }
    }
    return changed;
  }
  rerollCost(p: Player) {
    return Math.max(1, RULES.rerollCost - augmentValue(p.augments, "reroll"));
  }
  restoreRoom(input: Room) {
    const room = migrateRoom(input);
    this.rooms.set(room.key, room);
    for (const p of room.players.filter((p) => p.bot))
      if (
        ![...this.sessions.values()].some(
          (s) => s.key === room.key && s.playerId === p.id,
        )
      ) {
        const token = randomBytes(32).toString("hex");
        this.sessions.set(token, {
          token,
          key: room.key,
          playerId: p.id,
          seen: new Set(),
        });
      }
    return room;
  }
  practice(name: string, difficulty: Difficulty) {
    const session = this.create(name),
      room = this.rooms.get(session.key)!;
    for (let i = 0; i < STRATEGY.bots; i++) {
      const bot = this.join(room.key, "Bot " + (i + 1));
      const p = room.players.find((p) => p.id === bot.playerId)!;
      p.bot = { difficulty, plannedRound: 0 };
      p.ready = true;
    }
    room.mode = "practice";
    room.players[0].ready = true;
    this.action(session, "practice-start", { type: "start" });
    return session;
  }
  beginChoices(r: Room) {
    if (r.phase !== "Resolving") return;
    const rng = this.rng(r);
    for (const p of r.players.filter((p) => p.hp > 0))
      offerChoices(p, r.round, rng);
    r.seed = rng.state >>> 0;
    if (
      !r.players.some(
        (p) => p.pendingChoices?.item || p.pendingChoices?.augment,
      )
    ) {
      this.prepare(r);
      return;
    }
    r.phase = "Choosing";
    r.deadline = this.now() + STRATEGY.choiceMs / (this.speeds.get(r.key) ?? 1);
    this.runBots(r);
  }
  finishChoices(r: Room) {
    if (r.phase !== "Choosing") return;
    for (const p of r.players)
      for (const kind of ["item", "augment"] as const) {
        const c = p.pendingChoices?.[kind];
        if (c) choose(p, kind, c.round, 0);
      }
    this.prepare(r);
  }
  runBots(r: Room) {
    for (const p of r.players.filter((p) => p.bot && p.hp > 0)) {
      if (r.phase === "Preparing" && p.bot!.plannedRound === r.round) continue;
      if (r.phase === "Preparing") p.bot!.plannedRound = r.round;
      const session = [...this.sessions.values()].find(
        (s) => s.key === r.key && s.playerId === p.id,
      );
      if (!session) continue;
      let rerolls = 0;
      for (let i = 0; i < DIFFICULTY[p.bot!.difficulty].budget; i++) {
        const action = planBot(r, p, rerolls);
        if (!action) break;
        this.action(
          session,
          "bot:" + r.phase + ":" + r.round + ":" + i,
          action,
        );
        if (action.type === "reroll") rerolls++;
      }
    }
  }
  debug(r: Room, p: Player, a: Extract<Action, { type: "dev" }>) {
    if (a.command === "advance") {
      if (r.phase === "Lobby" || r.phase === "Finished")
        throw Error("No active phase.");
      r.deadline = this.now() - 1;
      return;
    }
    if (a.command === "speed") {
      const n = Number(a.value);
      if (![1, 5, 20].includes(n)) throw Error("Speed must be 1, 5 or 20.");
      this.speeds.set(r.key, n);
      return;
    }
    if (a.command === "seed") {
      const n = Number(a.value);
      if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff)
        throw Error("Invalid seed.");
      r.seed = n;
      return;
    }
    if (r.phase !== "Preparing" || this.now() >= r.deadline)
      throw Error("Use during preparation.");
    switch (a.command) {
      case "gold":
        p.gold += 50;
        break;
      case "level":
        p.level = Math.min(8, p.level + 1);
        break;
      case "shop":
        if (!UNIT_MAP[a.value ?? ""]) throw Error("Unknown unit.");
        releaseShop(r, p);
        p.shop = Array.from({ length: 5 }, () => {
          if ((r.pool?.available[a.value!] ?? 0) < 1) return null;
          reserve(r, a.value!);
          return a.value!;
        });
        break;
      case "unit": {
        if (!UNIT_MAP[a.value ?? ""]) throw Error("Unknown unit.");
        const slot = Array.from({ length: 8 }, (_, i) => 36 + i).find(
          (s) => !p.units.some((u) => u.slot === s),
        );
        if (slot === undefined) throw Error("Bench full.");
        reserve(r, a.value!);
        p.units.push({
          id: this.identity(),
          defId: a.value!,
          star: 1,
          slot,
          items: [],
        });
        mergeUnits(p);
        break;
      }
      case "item":
        if (!ITEMS.some((i) => i.id === a.value)) throw Error("Unknown item.");
        p.inventory.push(a.value!);
        break;
    }
  }
}
