import { ITEM_MAP, RULES, STAT_MULT, UNIT_MAP } from "./content";
import { battleStats } from "./stats";
import { RNG } from "./random";
import type {
  Battle,
  CombatEvent,
  CombatFrame,
  Fighter,
  Player,
} from "./types";
type Actor = Fighter & {
  attack: number;
  speed: number;
  range: number;
  armor: number;
  resist: number;
  moveSpeed: number;
  maxMana: number;
  cooldown: number;
  moveCooldown: number;
  spellCooldown: number;
  stun: number;
  slow: number;
  silence: number;
  items: string[];
  attacks: number;
  lifeline: boolean;
  spellPower: number;
  regen: number;
  crit: number;
  summons: number;
  targeting: string;
};
export function damageAfterResistance(raw: number, resistance: number) {
  return Math.max(
    1,
    Math.round(
      raw *
        (resistance >= 0
          ? 100 / (100 + resistance)
          : 2 - 100 / (100 - resistance)),
    ),
  );
}
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export function nextStep(
  from: { x: number; y: number },
  target: { x: number; y: number },
  occupied: Set<string>,
  range: number,
): { x: number; y: number } | null {
  const queue = [
    { x: from.x, y: from.y, first: null as { x: number; y: number } | null },
  ];
  const seen = new Set([`${from.x},${from.y}`]);
  while (queue.length) {
    const pos = queue.shift()!;
    if (distance(pos, target) <= range && pos.first) return pos.first;
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ]) {
      const x = pos.x + dx,
        y = pos.y + dy,
        key = `${x},${y}`;
      if (
        x < 0 ||
        x > 5 ||
        y < 0 ||
        y > 5 ||
        occupied.has(key) ||
        seen.has(key)
      )
        continue;
      seen.add(key);
      queue.push({ x, y, first: pos.first ?? { x, y } });
    }
  }
  return null;
}
function actors(p: Player, side: 0 | 1): Actor[] {
  const claimed = new Set<string>();
  return p.units
    .filter((u) => u.slot < 36)
    .sort((a, b) => a.slot - b.slot)
    .map((u) => {
      const d = UNIT_MAP[u.defId],
        stats = battleStats(u, p.units);
      let x = u.slot % 6,
        y = 3 + Math.floor(Math.floor(u.slot / 6) / 2);
      if (side === 1) {
        x = 5 - x;
        y = 5 - y;
      }
      if (claimed.has(`${x},${y}`)) {
        const free = Array.from({ length: 18 }, (_, i) => ({
          x: i % 6,
          y: side === 0 ? 3 + Math.floor(i / 6) : 2 - Math.floor(i / 6),
        })).find((pos) => !claimed.has(`${pos.x},${pos.y}`))!;
        x = free.x;
        y = free.y;
      }
      claimed.add(`${x},${y}`);
      const a: Actor = {
        ...stats,
        id: `${side}:${u.id}`,
        defId: u.defId,
        star: u.star,
        side,
        x,
        y,
        hp: stats.maxHp,
        status: [],
        cooldown: 0,
        moveCooldown: 0,
        spellCooldown: 0,
        stun: 0,
        slow: 0,
        silence: 0,
        items: [...u.items],
        attacks: 0,
        lifeline: false,
        summons: 0,
        targeting: d.targeting,
      };
      return a;
    });
}
export function simulate(
  a: Player,
  b: Player,
  seed: number,
  ghost = false,
): Battle {
  const rng = new RNG(seed);
  const units = [...actors(a, 0), ...actors(b, 1)];
  const frames: CombatFrame[] = [];
  let events: CombatEvent[] = [];
  let tick = 0;
  const emit = (
    type: CombatEvent["type"],
    source: string,
    target?: string,
    value?: number,
    text?: string,
  ) => events.push({ tick, type, source, target, value, text });
  const passive = (u: Actor, name: string) =>
    u.items
      .filter((id) => ITEM_MAP[id].passive === name)
      .reduce((n, id) => n + ITEM_MAP[id].amount, 0);
  const heal = (u: Actor, amount: number, source: string) => {
    const n = Math.min(u.maxHp - u.hp, Math.round(amount));
    if (n > 0) {
      u.hp += n;
      emit("heal", source, u.id, n);
    }
  };
  const hit = (s: Actor, t: Actor, raw: number, magic: boolean) => {
    if (t.hp <= 0) return 0;
    let n = damageAfterResistance(raw, magic ? t.resist : t.armor);
    const absorb = Math.min(t.shield, n);
    t.shield -= absorb;
    n -= absorb;
    t.hp = Math.max(0, t.hp - n);
    t.mana = Math.min(t.maxMana, t.mana + 8);
    emit("damage", s.id, t.id, n, magic ? "magic" : "physical");
    if (t.hp <= 0) emit("death", t.id);
    else if (!t.lifeline && t.hp < t.maxHp * 0.3 && passive(t, "lifeline")) {
      t.lifeline = true;
      t.shield += passive(t, "lifeline");
      emit("shield", t.id, t.id, passive(t, "lifeline"));
    }
    return n;
  };
  const snapshot = () =>
    frames.push({
      tick,
      units: units.map((u) => ({
        id: u.id,
        defId: u.defId,
        side: u.side,
        x: u.x,
        y: u.y,
        hp: Math.round(u.hp),
        maxHp: Math.round(u.maxHp),
        mana: Math.round(u.mana),
        shield: Math.round(u.shield),
        star: u.star,
        status: [
          ...(u.stun > 0 ? ["Stun"] : []),
          ...(u.slow > 0 ? ["Slow"] : []),
          ...(u.silence > 0 ? ["Silence"] : []),
        ],
        summon: u.summon,
        attack: u.attack,
        armor: u.armor,
        resist: u.resist,
        speed: u.speed,
        range: u.range,
        maxMana: u.maxMana,
        items: [...u.items],
      })),
      events: [...events],
    });
  snapshot();
  for (tick = 1; tick <= RULES.maxTicks; tick++) {
    events = [];
    if (
      !units.some((u) => u.side === 0 && u.hp > 0) ||
      !units.some((u) => u.side === 1 && u.hp > 0)
    )
      break;
    // Alternate initiative each tick so the first player does not always attack first.
    const order = [...units];
    if (tick % 2 === 0) order.reverse();
    for (const u of order) {
      if (u.hp <= 0) continue;
      u.cooldown -= 0.25;
      u.moveCooldown -= 0.25;
      u.spellCooldown -= 0.25;
      u.stun = Math.max(0, u.stun - 0.25);
      u.slow = Math.max(0, u.slow - 0.25);
      u.silence = Math.max(0, u.silence - 0.25);
      if (tick % 4 === 0) heal(u, u.regen, u.id);
      if (u.stun > 0) continue;
      const enemies = units.filter((t) => t.side !== u.side && t.hp > 0);
      if (!enemies.length) break;
      enemies.sort((x, y) =>
        u.targeting === "weakest"
          ? x.hp - y.hp || distance(u, x) - distance(u, y)
          : u.targeting === "farthest"
            ? distance(u, y) - distance(u, x)
            : distance(u, x) - distance(u, y),
      );
      const target = enemies[0];
      if (
        u.mana >= u.maxMana &&
        u.silence === 0 &&
        u.spellCooldown <= 0 &&
        !u.summon
      ) {
        u.mana = 0;
        u.spellCooldown = 2;
        const skill = UNIT_MAP[u.defId].skill;
        const power = skill.power * STAT_MULT[u.star] * u.spellPower;
        emit("cast", u.id, target.id, 0, skill.name);
        if (skill.kind === "heal" || skill.kind === "shield") {
          const ally = units
            .filter((t) => t.side === u.side && t.hp > 0)
            .sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
          if (skill.kind === "heal") heal(ally, power, u.id);
          else {
            ally.shield += power;
            emit("shield", u.id, ally.id, Math.round(power));
          }
        } else if (skill.kind === "summon") {
          const spot = nextStep(
            u,
            { x: target.x, y: target.y },
            new Set(units.filter((t) => t.hp > 0).map((t) => `${t.x},${t.y}`)),
            0,
          );
          const adjacent = [
            [u.x + 1, u.y],
            [u.x - 1, u.y],
            [u.x, u.y + 1],
            [u.x, u.y - 1],
          ].find(
            ([x, y]) =>
              x >= 0 &&
              x < 6 &&
              y >= 0 &&
              y < 6 &&
              !units.some((t) => t.hp > 0 && t.x === x && t.y === y),
          );
          if (u.summons < 2 && (adjacent || spot)) {
            const pos = adjacent ? { x: adjacent[0], y: adjacent[1] } : spot!;
            u.summons++;
            const echo: Actor = {
              ...u,
              ...pos,
              id: `${u.id}:echo${u.summons}`,
              summon: true,
              hp: power * 1.5,
              maxHp: power * 1.5,
              attack: power * 0.22,
              mana: 0,
              shield: 0,
              items: [],
              range: 1,
              stun: 0,
              slow: 0,
              silence: 0,
              regen: 0,
            };
            units.push(echo);
            emit("summon", u.id, echo.id);
          }
        } else {
          const targets =
            skill.kind === "burst" || skill.kind === "cleave"
              ? enemies.filter((t) => distance(t, target) <= 1)
              : [target];
          for (const t of targets) {
            hit(u, t, power, skill.kind !== "cleave");
            if (
              t.hp > 0 &&
              (skill.kind === "stun" ||
                skill.kind === "slow" ||
                skill.kind === "silence")
            ) {
              t[skill.kind] = skill.kind === "stun" ? 1.25 : 3.25;
              emit("status", u.id, t.id, 0, skill.kind);
            }
          }
        }
        continue;
      }
      if (distance(u, target) > u.range) {
        if (u.moveCooldown <= 0) {
          const occupied = new Set(
            units
              .filter((t) => t.hp > 0 && t.id !== u.id)
              .map((t) => `${t.x},${t.y}`),
          );
          const step = nextStep(u, target, occupied, u.range);
          if (step) {
            u.x = step.x;
            u.y = step.y;
            u.moveCooldown = (1 / u.moveSpeed) * (u.slow > 0 ? 2 : 1);
            emit("move", u.id);
          }
        }
        continue;
      }
      if (u.cooldown <= 0) {
        u.cooldown = (1 / u.speed) * (u.slow > 0 ? 2 : 1);
        u.attacks++;
        const crit = rng.next() < u.crit;
        emit("attack", u.id, target.id, 0, crit ? "critical" : "");
        const dealt = hit(u, target, u.attack * (crit ? 1.5 : 1), false);
        u.mana = Math.min(
          u.maxMana,
          u.mana + 20 + u.items.filter((i) => i === "moonwell").length * 5,
        );
        heal(u, dealt * passive(u, "lifesteal"), u.id);
        if (passive(target, "thorns"))
          hit(target, u, passive(target, "thorns"), true);
        if (u.attacks % 3 === 0 && passive(u, "spark"))
          hit(u, target, passive(u, "spark"), true);
      }
    }
    snapshot();
  }
  const left = units.filter((u) => u.hp > 0 && u.side === 0),
    right = units.filter((u) => u.hp > 0 && u.side === 1);
  const winner: 0 | 1 | null =
    left.length && !right.length ? 0 : right.length && !left.length ? 1 : null;
  const survivors = winner === 0 ? left : right;
  return {
    id: `${a.id}-${b.id}-${seed}`,
    a: a.id,
    b: b.id,
    ghost,
    seed,
    winner,
    damage:
      winner === null
        ? 0
        : survivors.reduce((n, u) => n + (u.summon ? 1 : u.star * 2), 0),
    frames,
    duration: Math.max(1500, frames.length * RULES.tickMs),
  };
}
