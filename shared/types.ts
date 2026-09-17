export type Phase =
  | "Lobby"
  | "Preparing"
  | "Battling"
  | "Resolving"
  | "Finished";
export type Star = 1 | 2 | 3;
export interface Unit {
  id: string;
  defId: string;
  star: Star;
  slot: number;
  items: string[];
}
export interface Player {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  shop: (string | null)[];
  locked: boolean;
  units: Unit[];
  inventory: string[];
  streak: number;
  rank?: number;
  lastResult?: string;
}
export interface Fighter {
  id: string;
  defId: string;
  side: 0 | 1;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mana: number;
  shield: number;
  star: Star;
  status: string[];
  summon?: boolean;
}
export interface CombatEvent {
  tick: number;
  type:
    | "move"
    | "attack"
    | "cast"
    | "damage"
    | "death"
    | "heal"
    | "shield"
    | "status"
    | "summon";
  source: string;
  target?: string;
  value?: number;
  text?: string;
}
export interface CombatFrame {
  tick: number;
  units: Fighter[];
  events: CombatEvent[];
}
export interface Battle {
  id: string;
  a: string;
  b: string;
  ghost: boolean;
  seed: number;
  winner: 0 | 1 | null;
  damage: number;
  frames: CombatFrame[];
  duration: number;
}
export interface Room {
  key: string;
  hostId: string;
  phase: Phase;
  round: number;
  deadline: number;
  seed: number;
  players: Player[];
  battles: Battle[];
  createdAt: number;
  updatedAt: number;
  revision: number;
}
export interface Snapshot {
  version: 1;
  room: Room;
  you: string;
  serverTime: number;
  devTools: boolean;
}
export type Action =
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "buy"; index: number }
  | { type: "sell"; unitId: string }
  | { type: "move"; unitId: string; slot: number }
  | { type: "reroll" }
  | { type: "lock" }
  | { type: "xp" }
  | { type: "equip"; unitId: string; itemIndex: number }
  | { type: "unequip"; unitId: string; itemIndex: number }
  | {
      type: "dev";
      command:
        | "gold"
        | "level"
        | "seed"
        | "shop"
        | "unit"
        | "item"
        | "advance"
        | "speed";
      value?: string;
    };
export interface Envelope {
  version: 1;
  id: string;
  action: Action;
}
export interface Reply {
  ok: boolean;
  error?: string;
  key?: string;
  token?: string;
  playerId?: string;
}
