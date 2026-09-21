import type { Unit, Star } from "./types";
export type Difficulty = "easy" | "normal" | "hard";
export type ChoiceKind = "item" | "augment";
export interface PendingChoice {
  round: number;
  options: string[];
}
export interface IncomeBreakdown {
  round: number;
  before: number;
  after: number;
  total: number;
  base: number;
  interest: number;
  win: number;
  loss: number;
  winStreak: number;
  loseStreak: number;
  augment: number;
  other: number;
  capped: number;
}
export interface CombatSummary {
  round: number;
  result: "win" | "loss" | "draw";
  playerDamage: number;
  survivors: number;
  topDamage?: { name: string; amount: number };
  topTaken?: { name: string; amount: number };
  casts: number;
  shieldsGranted: number;
  shieldsBroken: number;
  ownTraits: { name: string; count: number; tier: number }[];
  enemyTraits: { name: string; count: number; tier: number }[];
  augments: string[];
}
export interface ScoutingView {
  seat: number;
  name: string;
  hp: number;
  level: number;
  connected: boolean;
  eliminated: boolean;
  units: { defId: string; star: Star; slot: number; items: string[] }[];
  traits: {
    name: string;
    count: number;
    tier: number;
    next?: number;
    needed: number;
  }[];
  augments: string[];
}
export interface PoolState {
  version: 1;
  total: Record<string, number>;
  available: Record<string, number>;
}
export interface BotPerception {
  gold: number;
  level: number;
  units: Unit[];
  shop: (string | null)[];
  inventory: string[];
  opponents: ScoutingView[];
}
