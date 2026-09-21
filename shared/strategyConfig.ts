import { z } from "zod";
export const STRATEGY = {
  itemRounds: [1, 3, 5, 7, 9],
  augmentRounds: [2, 5, 8],
  choiceMs: 20000,
  bots: 3,
  inventoryLimit: 90,
  poolCopies: [30, 24, 18, 12, 9],
};
const augmentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    en: z.string(),
    description: z.string(),
    descriptionEn: z.string(),
    effect: z.enum([
      "frontArmor",
      "speed",
      "mana",
      "items",
      "income",
      "streak",
      "ember",
      "rookie",
      "underdog",
      "rareShop",
      "reroll",
      "backRange",
    ]),
    value: z.number().positive(),
    conflict: z.array(z.string()),
  })
  .strict();
export const AUGMENTS = z.array(augmentSchema).parse([
  {
    id: "bastion",
    name: "แนวกำแพงเมฆ",
    en: "Cloud Bastion",
    description: "แถวหน้า (แถว 4) ได้เกราะ +18 ตลอดแมตช์",
    descriptionEn: "Front row gains 18 armor for the match.",
    effect: "frontArmor",
    value: 18,
    conflict: [],
  },
  {
    id: "tempo",
    name: "จังหวะสายลม",
    en: "Wind Tempo",
    description: "ทุกตัวโจมตีเร็วขึ้น 12% ตลอดแมตช์",
    descriptionEn: "All units gain 12% attack speed for the match.",
    effect: "speed",
    value: 0.12,
    conflict: [],
  },
  {
    id: "spring",
    name: "ธารแสงแรก",
    en: "Firstlight Spring",
    description: "ทุกตัวเริ่มต่อสู้ด้วยมานาเพิ่ม 20 ตลอดแมตช์",
    descriptionEn: "All units start with 20 extra mana for the match.",
    effect: "mana",
    value: 20,
    conflict: [],
  },
  {
    id: "artisan",
    name: "ช่างแห่งเกาะลอย",
    en: "Isle Artisan",
    description: "ค่าสถานะหลักจากไอเทมเพิ่ม 25% ไม่รวมพาสซีฟ ตลอดแมตช์",
    descriptionEn:
      "Item base stat bonuses increase 25%; passives excluded, for the match.",
    effect: "items",
    value: 0.25,
    conflict: [],
  },
  {
    id: "stipend",
    name: "เสบียงประจำทาง",
    en: "Wayfarer Stipend",
    description: "รายได้หลังต่อสู้เพิ่ม 1 ทองทุกครั้ง ตลอดแมตช์",
    descriptionEn: "Gain 1 extra gold after each battle for the match.",
    effect: "income",
    value: 1,
    conflict: ["economy"],
  },
  {
    id: "resolve",
    name: "แรงส่งต่อเนื่อง",
    en: "Steady Resolve",
    description: "ชนะหรือแพ้ติดกันตั้งแต่ 2 รอบ ได้รายได้เพิ่ม 2 ทอง ตลอดแมตช์",
    descriptionEn:
      "At a win or loss streak of 2+, gain 2 extra gold for the match.",
    effect: "streak",
    value: 2,
    conflict: ["economy"],
  },
  {
    id: "embers",
    name: "ประกายร่วมใจ",
    en: "United Embers",
    description: "ตัวละคร Emberkin ได้พลังโจมตี +20 ตลอดแมตช์",
    descriptionEn: "Emberkin units gain 20 attack for the match.",
    effect: "ember",
    value: 20,
    conflict: [],
  },
  {
    id: "rookies",
    name: "ดาวดวงเล็ก",
    en: "Little Stars",
    description: "ตัวละคร 1 ดาวได้พลังชีวิต +180 ตลอดแมตช์",
    descriptionEn: "One-star units gain 180 health for the match.",
    effect: "rookie",
    value: 180,
    conflict: [],
  },
  {
    id: "outnumbered",
    name: "ยืนน้อยแต่มั่นคง",
    en: "Defiant Few",
    description: "หากเริ่มต่อสู้ด้วยจำนวนน้อยกว่าศัตรู ทุกตัวได้โล่ +150",
    descriptionEn:
      "Start with 150 shield per unit when outnumbered, for the match.",
    effect: "underdog",
    value: 150,
    conflict: [],
  },
  {
    id: "discovery",
    name: "แผนที่ลับ",
    en: "Hidden Atlas",
    description:
      "น้ำหนักสุ่มระดับหายาก (ราคา 3) คูณ 1.5 แล้วปรับสัดส่วนใหม่ ตลอดแมตช์",
    descriptionEn:
      "Multiply rare (cost 3) shop weight by 1.5 then normalize, for the match.",
    effect: "rareShop",
    value: 1.5,
    conflict: [],
  },
  {
    id: "bargain",
    name: "เส้นทางการค้า",
    en: "Trade Route",
    description: "รีโรลร้านค้าราคา 1 ทองแทน 2 ตลอดแมตช์",
    descriptionEn: "Rerolls cost 1 gold instead of 2 for the match.",
    effect: "reroll",
    value: 1,
    conflict: [],
  },
  {
    id: "lookout",
    name: "หอสังเกตการณ์",
    en: "Sky Lookout",
    description: "ตัวละครที่เริ่มแถวหลังสุดได้ระยะโจมตี +1 ตลอดการต่อสู้",
    descriptionEn:
      "Units starting in the back row gain 1 attack range for the battle.",
    effect: "backRange",
    value: 1,
    conflict: [],
  },
]);
export const AUGMENT_MAP = Object.fromEntries(AUGMENTS.map((a) => [a.id, a]));
export function augmentValue(
  ids: string[] | undefined,
  effect: (typeof AUGMENTS)[number]["effect"],
) {
  return [...new Set(ids ?? [])].reduce(
    (n, id) =>
      n + (AUGMENT_MAP[id]?.effect === effect ? AUGMENT_MAP[id].value : 0),
    0,
  );
}
export function eligibleAugments(selected: string[]) {
  const conflicts = new Set(
    selected.flatMap((id) => AUGMENT_MAP[id]?.conflict ?? []),
  );
  return AUGMENTS.filter(
    (a) =>
      !selected.includes(a.id) && !a.conflict.some((tag) => conflicts.has(tag)),
  );
}
export const DIFFICULTY = {
  easy: {
    label: "ง่าย",
    en: "Easy",
    budget: 8,
    reserve: 0,
    synergy: 0,
    rerolls: 0,
  },
  normal: {
    label: "ปกติ",
    en: "Normal",
    budget: 20,
    reserve: 10,
    synergy: 30,
    rerolls: 1,
  },
  hard: {
    label: "ยาก",
    en: "Hard",
    budget: 32,
    reserve: 20,
    synergy: 60,
    rerolls: 2,
  },
};
