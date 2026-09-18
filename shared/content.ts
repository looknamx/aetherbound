import { z } from "zod";
export const ORIGINS = [
  "Emberkin",
  "Tideborn",
  "Verdant",
  "Astral",
  "Ironveil",
] as const;
export const CLASSES = [
  "Warden",
  "Striker",
  "Ranger",
  "Arcanist",
  "Weaver",
] as const;
export const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
export const COLORS = ["#d3dbdf", "#8dddac", "#84bdf5", "#c5a1f4", "#f2d17d"];
export const ROLES = [
  "Tank",
  "Fighter",
  "Assassin",
  "Ranger",
  "Mage",
  "Support",
  "Summoner",
] as const;
export type UnitRole = (typeof ROLES)[number];
export const BOARD = { size: 6, cells: 36, benchStart: 36, benchEnd: 44 };
export const ROLE_CONFIG: Record<
  UnitRole,
  {
    icon: string;
    color: string;
    short: string;
    rows: number[];
    columns: number[];
  }
> = {
  Tank: {
    icon: "⬡",
    color: "#a9cfe0",
    short: "Tank",
    rows: [3, 4, 5],
    columns: [2, 3, 1, 4, 0, 5],
  },
  Fighter: {
    icon: "⚔",
    color: "#edb991",
    short: "Fight",
    rows: [3, 4, 5],
    columns: [2, 3, 1, 4, 0, 5],
  },
  Assassin: {
    icon: "➶",
    color: "#d1b2ef",
    short: "Assn",
    rows: [3, 4, 5],
    columns: [0, 5, 1, 4, 2, 3],
  },
  Ranger: {
    icon: "⌁",
    color: "#a9dbb0",
    short: "Range",
    rows: [5, 4, 3],
    columns: [2, 3, 1, 4, 0, 5],
  },
  Mage: {
    icon: "✦",
    color: "#b7b8f3",
    short: "Mage",
    rows: [5, 4, 3],
    columns: [2, 3, 1, 4, 0, 5],
  },
  Support: {
    icon: "✧",
    color: "#9fdfd2",
    short: "Supp",
    rows: [5, 4, 3],
    columns: [2, 3, 1, 4, 0, 5],
  },
  Summoner: {
    icon: "❖",
    color: "#d4cf9b",
    short: "Summ",
    rows: [4, 5, 3],
    columns: [2, 3, 1, 4, 0, 5],
  },
};
const CLASS_ROLES: Record<(typeof CLASSES)[number], UnitRole> = {
  Warden: "Tank",
  Striker: "Fighter",
  Ranger: "Ranger",
  Arcanist: "Mage",
  Weaver: "Support",
};
const ROLE_OVERRIDES: Record<string, UnitRole> = {
  thorn: "Assassin",
  moss: "Summoner",
  grove: "Summoner",
};
export const RULES = {
  prepMs: 30000,
  resultMs: 5000,
  tickMs: 250,
  maxTicks: 160,
  startGold: 10,
  rerollCost: 2,
  xpCost: 4,
  xpAmount: 4,
  baseIncome: 5,
  interestCap: 5,
  maxLevel: 8,
  benchSize: 8,
  maxItems: 3,
  itemDropChance: 0.45,
  roomTtlMs: 6 * 60 * 60 * 1000,
  emptyTtlMs: 10 * 60 * 1000,
};
export const ODDS: number[][] = [
  [100, 0, 0, 0, 0],
  [80, 20, 0, 0, 0],
  [65, 30, 5, 0, 0],
  [50, 35, 15, 0, 0],
  [35, 35, 25, 5, 0],
  [25, 30, 30, 14, 1],
  [18, 24, 32, 22, 4],
  [12, 18, 30, 30, 10],
];
export const XP_TO_LEVEL = [0, 2, 4, 8, 12, 20, 28, 36, 999];
export const STAT_MULT = [0, 1, 1.8, 3.24];
const skillSchema = z.object({
  name: z.string(),
  kind: z.enum([
    "burst",
    "stun",
    "slow",
    "silence",
    "heal",
    "shield",
    "summon",
    "cleave",
  ]),
  power: z.number().positive(),
  description: z.string(),
});
const unitSchema = z.object({
  id: z.string(),
  name: z.string(),
  glyph: z.string(),
  cost: z.number().int().min(1).max(5),
  origin: z.enum(ORIGINS),
  class: z.enum(CLASSES),
  role: z.enum(ROLES),
  hp: z.number().positive(),
  attack: z.number().positive(),
  speed: z.number().positive(),
  range: z.number().int().positive(),
  armor: z.number(),
  resist: z.number(),
  mana: z.number().nonnegative(),
  maxMana: z.number().positive(),
  moveSpeed: z.number().positive(),
  targeting: z.enum(["nearest", "weakest", "farthest"]),
  skill: skillSchema,
});
export type UnitDef = z.infer<typeof unitSchema>;
const rows: [
  string,
  string,
  number,
  number,
  number,
  string,
  UnitDef["skill"]["kind"],
][] = [
  ["cinder", "Cinder Sentry", 1, 0, 0, "CS", "shield"],
  ["brook", "Brook Whisper", 1, 1, 4, "BW", "heal"],
  ["thorn", "Thorn Runner", 1, 2, 1, "TR", "slow"],
  ["lumen", "Lumen Scout", 1, 3, 2, "LS", "burst"],
  ["rivet", "Rivet Guard", 1, 4, 0, "RG", "stun"],
  ["flare", "Flare Dancer", 2, 0, 1, "FD", "cleave"],
  ["reef", "Reef Harrier", 2, 1, 2, "RH", "slow"],
  ["moss", "Moss Oracle", 2, 2, 4, "MO", "summon"],
  ["nova", "Nova Scribe", 2, 3, 3, "NS", "silence"],
  ["anvil", "Anvil Walker", 3, 4, 1, "AW", "stun"],
  ["pyre", "Pyre Seer", 3, 0, 3, "PS", "burst"],
  ["rill", "Rill Custodian", 3, 1, 0, "RC", "shield"],
  ["briar", "Briar Archer", 3, 2, 2, "BA", "cleave"],
  ["vesper", "Vesper Echo", 4, 3, 4, "VE", "heal"],
  ["coil", "Coil Savant", 4, 4, 3, "CV", "silence"],
  ["grove", "Grove Colossus", 4, 2, 0, "GC", "summon"],
  ["solara", "Solara, Last Dawn", 5, 0, 4, "SD", "burst"],
  ["abyss", "Abyss Cartographer", 5, 1, 3, "AC", "stun"],
];
const skillNames: Record<UnitDef["skill"]["kind"], string> = {
  burst: "Starfall",
  stun: "Resonant Impact",
  slow: "Grasping Current",
  silence: "Quiet Horizon",
  heal: "Renewal Thread",
  shield: "Prism Barrier",
  summon: "Echo Seed",
  cleave: "Crescent Wake",
};
const descriptions: Record<UnitDef["skill"]["kind"], string> = {
  burst: "Deals magic damage to enemies within 1 tile of the target.",
  stun: "Deals magic damage and stuns the target for 1 second.",
  slow: "Deals magic damage and halves target attack and movement speed for 3 seconds.",
  silence: "Deals magic damage and prevents target spells for 3 seconds.",
  heal: "Restores health to the most wounded ally.",
  shield: "Grants a protective shield to the most wounded ally.",
  summon: "Summons an echo beside the caster. Maximum 2 echoes per caster.",
  cleave: "Deals physical damage to enemies within 1 tile of the target.",
};
export const UNITS: UnitDef[] = rows.map(
  ([id, name, cost, o, c, glyph, kind]) =>
    unitSchema.parse({
      id,
      name,
      cost,
      origin: ORIGINS[o],
      class: CLASSES[c],
      role: ROLE_OVERRIDES[id] ?? CLASS_ROLES[CLASSES[c]],
      glyph,
      hp: (c === 0 ? 780 : c === 1 ? 600 : 450) + cost * 60,
      attack: (c === 2 ? 66 : 48) + cost * 8,
      speed: c === 1 ? 1.15 : 0.85,
      range: c === 2 ? 3 : c === 3 || c === 4 ? 2 : 1,
      armor: c === 0 ? 32 : 15,
      resist: c === 3 ? 25 : 12,
      mana: c === 4 ? 40 : 0,
      maxMana: 100,
      moveSpeed: 2,
      targeting: c === 1 ? "farthest" : c === 2 ? "weakest" : "nearest",
      skill: {
        name: `${name.split(" ")[0]} ${skillNames[kind]}`,
        kind,
        power: 100 + cost * 45,
        description: descriptions[kind],
      },
    }),
);
export const UNIT_MAP = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export type ItemDef = {
  id: string;
  name: string;
  glyph: string;
  description: string;
  stat?: "attack" | "hp" | "armor" | "resist" | "speed" | "mana";
  amount: number;
  passive?: "lifesteal" | "thorns" | "lifeline" | "spark" | "regen" | "crit";
};
export const ITEMS: ItemDef[] = [
  {
    id: "sunshard",
    name: "Sunshard",
    glyph: "✦",
    description: "+22 attack damage.",
    stat: "attack",
    amount: 22,
  },
  {
    id: "heartglass",
    name: "Heartglass",
    glyph: "◇",
    description: "+200 maximum health.",
    stat: "hp",
    amount: 200,
  },
  {
    id: "ironleaf",
    name: "Ironleaf",
    glyph: "⬡",
    description: "+25 armor.",
    stat: "armor",
    amount: 25,
  },
  {
    id: "mistcloak",
    name: "Mistcloak",
    glyph: "≋",
    description: "+25 magic resistance.",
    stat: "resist",
    amount: 25,
  },
  {
    id: "windcoil",
    name: "Windcoil",
    glyph: "↟",
    description: "+25% attack speed.",
    stat: "speed",
    amount: 0.25,
  },
  {
    id: "moonwell",
    name: "Moonwell",
    glyph: "☽",
    description: "+30 starting mana and +5 mana per attack.",
    stat: "mana",
    amount: 30,
  },
  {
    id: "bloodopal",
    name: "Blood Opal",
    glyph: "◆",
    description: "Basic attacks heal for 20% of damage dealt.",
    passive: "lifesteal",
    amount: 0.2,
  },
  {
    id: "thornseal",
    name: "Thorn Seal",
    glyph: "✳",
    description: "When attacked, reflect 16 magic damage.",
    passive: "thorns",
    amount: 16,
  },
  {
    id: "dawnshell",
    name: "Dawn Shell",
    glyph: "◈",
    description: "Once per battle below 30% HP, gain a 300 shield.",
    passive: "lifeline",
    amount: 300,
  },
  {
    id: "stormpin",
    name: "Storm Pin",
    glyph: "ϟ",
    description: "Every third attack deals 70 bonus magic damage.",
    passive: "spark",
    amount: 70,
  },
  {
    id: "dewstone",
    name: "Dewstone",
    glyph: "●",
    description: "Regenerate 12 health each second.",
    passive: "regen",
    amount: 12,
  },
  {
    id: "prismfang",
    name: "Prism Fang",
    glyph: "△",
    description: "+20% critical hit chance. Critical attacks deal 150% damage.",
    passive: "crit",
    amount: 0.2,
  },
];
export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const TRAITS = [
  {
    id: "Emberkin",
    description: "All allies gain 10 / 20 attack.",
    thresholds: [2, 4],
  },
  {
    id: "Tideborn",
    description: "All allies gain 10 / 20 magic resistance.",
    thresholds: [2, 4],
  },
  {
    id: "Verdant",
    description: "All allies gain 100 / 200 health.",
    thresholds: [2, 4],
  },
  {
    id: "Astral",
    description: "All allies gain 15 / 30 starting mana.",
    thresholds: [2, 4],
  },
  {
    id: "Ironveil",
    description: "All allies gain 12 / 24 armor.",
    thresholds: [2, 4],
  },
  {
    id: "Warden",
    description: "All allies begin battle with 80 / 160 shield.",
    thresholds: [2, 4],
  },
  {
    id: "Striker",
    description: "All allies gain 15% / 30% attack speed.",
    thresholds: [2, 4],
  },
  {
    id: "Ranger",
    description: "All allies gain 10% / 20% critical chance.",
    thresholds: [2, 4],
  },
  {
    id: "Arcanist",
    description: "All allied spells gain 20% / 40% power.",
    thresholds: [2, 4],
  },
  {
    id: "Weaver",
    description: "All allies regenerate 8 / 16 health each second.",
    thresholds: [2, 4],
  },
];
export function validateContent() {
  z.array(unitSchema).min(18).parse(UNITS);
  if (new Set(UNITS.map((u) => u.id)).size !== UNITS.length)
    throw Error("Duplicate unit ID");
  for (const row of ODDS)
    if (row.length !== 5 || row.reduce((a, b) => a + b, 0) !== 100)
      throw Error("Invalid shop odds");
  for (const item of ITEMS)
    z.object({
      id: z.string(),
      name: z.string(),
      amount: z.number().positive(),
      description: z.string(),
    }).parse(item);
}
validateContent();
