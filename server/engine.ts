import { randomBytes, randomUUID } from "node:crypto";
import { ITEMS, RULES, UNIT_MAP } from "../shared/content";
import {
  addXP,
  buy,
  equip,
  income,
  mergeUnits,
  move,
  rollShop,
  sell,
} from "../shared/economy";
import { simulate } from "../shared/combat";
import { RNG } from "../shared/random";
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
  constructor(public onFinish: (room: Room) => void = () => {}) {}
  create(name: string) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let key: string;
    do {
      key = Array.from(
        randomBytes(6),
        (b) => alphabet[b % alphabet.length],
      ).join("");
    } while (this.rooms.has(key));
    const now = Date.now();
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
    return this.join(key, name);
  }
  join(key: string, name: string) {
    const r = this.rooms.get(key);
    if (!r || Date.now() - r.createdAt > RULES.roomTtlMs)
      throw Error("Room not found or expired.");
    if (r.phase !== "Lobby") throw Error("This match has already started.");
    if (r.players.length >= 4) throw Error("This room is full.");
    const id = randomUUID(),
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
    r.updatedAt = Date.now();
  }
  reconnect(token: string) {
    const s = this.sessions.get(token);
    if (!s || !this.rooms.has(s.key))
      throw Error("Session expired. Create or join a room.");
    const r = this.rooms.get(s.key)!;
    r.players.find((p) => p.id === s.playerId)!.connected = true;
    if (!r.players.some((p) => p.id === r.hostId && p.connected))
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
      r.hostId = r.players.find((x) => x.connected)?.id ?? p.id;
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
    r.updatedAt = Date.now();
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
    } else if (action.type === "dev") {
      if (!dev || p.id !== r.hostId)
        throw Error("Developer tools are disabled.");
      this.debug(r, p, action);
    } else {
      if (r.phase !== "Preparing" || p.hp <= 0)
        throw Error("You can only change your team during preparation.");
      const rng = this.rng(r);
      switch (action.type) {
        case "buy":
          buy(p, action.index, randomUUID());
          break;
        case "sell":
          sell(p, action.unitId);
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
          if (p.gold < RULES.rerollCost) throw Error("Not enough gold.");
          p.gold -= RULES.rerollCost;
          p.shop = rollShop(p.level, rng);
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
      if (!p.locked) p.shop = rollShop(p.level, rng);
    }
    r.seed = rng.state >>> 0;
    r.deadline = Date.now() + RULES.prepMs / (this.speeds.get(r.key) ?? 1);
  }
  battle(r: Room) {
    r.phase = "Battling";
    const active = r.players.filter((p) => p.hp > 0);
    const rotation = r.round % active.length;
    const ordered = [...active.slice(rotation), ...active.slice(0, rotation)];
    r.battles = [];
    const rng = this.rng(r);
    for (let i = 0; i < ordered.length; i += 2) {
      const a = ordered[i],
        b = ordered[i + 1] ?? ordered[0];
      r.battles.push(
        simulate(a, b, Math.floor(rng.next() * 0xffffffff), !ordered[i + 1]),
      );
    }
    r.seed = rng.state >>> 0;
    r.deadline =
      Date.now() +
      Math.max(...r.battles.map((b) => b.duration)) /
        (this.speeds.get(r.key) ?? 1);
  }
  resolve(r: Room) {
    r.phase = "Resolving";
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
      const earned = income(p) + (result.win ? 1 : 0);
      p.gold += earned;
      addXP(p, 2);
      p.lastResult = `${result.win === null ? "Draw" : result.win ? "Victory" : "Defeat"} · ${result.damage ? `−${result.damage} HP · ` : ""}+${earned} gold`;
      if (rng.next() < RULES.itemDropChance && p.inventory.length < 90)
        p.inventory.push(rng.pick(ITEMS).id);
    }
    r.seed = rng.state >>> 0;
    const newlyOut = r.players
      .filter((p) => p.hp === 0 && !p.rank)
      .sort((a, b) => a.gold - b.gold || a.id.localeCompare(b.id));
    let rank = r.players.filter((p) => !p.rank).length;
    for (const p of newlyOut) p.rank = rank--;
    const remaining = r.players.filter((p) => p.hp > 0);
    if (remaining.length <= 1) {
      if (remaining[0]) remaining[0].rank = 1;
      r.phase = "Finished";
      r.deadline = 0;
      this.onFinish(structuredClone(r));
    } else
      r.deadline = Date.now() + RULES.resultMs / (this.speeds.get(r.key) ?? 1);
  }
  tick(now = Date.now()) {
    const changed: string[] = [];
    for (const r of this.rooms.values()) {
      if (
        now - r.createdAt > RULES.roomTtlMs ||
        (!r.players.some((p) => p.connected) &&
          now - r.updatedAt > RULES.emptyTtlMs)
      ) {
        this.rooms.delete(r.key);
        this.speeds.delete(r.key);
        for (const [token, s] of this.sessions)
          if (s.key === r.key) this.sessions.delete(token);
        changed.push(r.key);
        continue;
      }
      if (r.deadline && now >= r.deadline) {
        if (r.phase === "Preparing") this.battle(r);
        else if (r.phase === "Battling") this.resolve(r);
        else if (r.phase === "Resolving") this.prepare(r);
        r.revision++;
        changed.push(r.key);
      }
    }
    return changed;
  }
  debug(r: Room, p: Player, a: Extract<Action, { type: "dev" }>) {
    if (a.command === "advance") {
      if (r.phase === "Lobby" || r.phase === "Finished")
        throw Error("No active phase.");
      r.deadline = Date.now() - 1;
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
    if (r.phase !== "Preparing") throw Error("Use during preparation.");
    switch (a.command) {
      case "gold":
        p.gold += 50;
        break;
      case "level":
        p.level = Math.min(8, p.level + 1);
        break;
      case "shop":
        if (!UNIT_MAP[a.value ?? ""]) throw Error("Unknown unit.");
        p.shop = Array(5).fill(a.value);
        break;
      case "unit": {
        if (!UNIT_MAP[a.value ?? ""]) throw Error("Unknown unit.");
        const slot = Array.from({ length: 8 }, (_, i) => 36 + i).find(
          (s) => !p.units.some((u) => u.slot === s),
        );
        if (slot === undefined) throw Error("Bench full.");
        p.units.push({
          id: randomUUID(),
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
