import { UNIT_MAP } from "../../shared/content";
import type { BattleStatsSnapshot } from "../../shared/types";

export const STAT_LABELS = {
  damageDealt: "ความเสียหายที่ทำได้",
  damageTaken: "ความเสียหายที่ได้รับ",
  position: "ตำแหน่งเดิมในทีม",
  absorbed: "ความเสียหายที่โล่ดูดซับ",
  casts: "จำนวนครั้งที่ใช้สกิล",
  details: "ค่าจริง / รายละเอียด",
  missing: "ยังไม่มีข้อมูล",
} as const;
export type DisplaySort = "damageDealt" | "damageTaken" | "position";
export interface BattleStatDisplay {
  name: string;
  portrait?: string;
  stars: number;
  position?: number;
  damageDealt?: number;
  damageTaken?: number;
  shieldAbsorbed?: number;
  skillCasts?: number;
}
export interface BattleStatsDisplay {
  title: string;
  recordedRound?: string;
  rows: BattleStatDisplay[];
}
const numeric = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
export function roundLabel(value: unknown): string | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? `รอบ ${value}`
    : undefined;
}
export function exactDamage(value: number | undefined) {
  return numeric(value) === undefined
    ? "—"
    : value!.toLocaleString("th-TH", { maximumFractionDigits: 20 });
}
export function formatDamage(value: number | undefined) {
  if (numeric(value) === undefined) return "—";
  if (value! >= 1_000_000) return `${(value! / 1_000_000).toFixed(1)} ล้าน`;
  if (value! >= 1_000) return `${(value! / 1_000).toFixed(1)} พัน`;
  return exactDamage(value);
}
/** Only this explicit projection crosses into the player-facing panel. Never expose metadata or ID fallbacks. */
export function battleStatsDisplay(
  snapshot?: BattleStatsSnapshot,
  sort: DisplaySort = "damageDealt",
): BattleStatsDisplay {
  const recordedRound = roundLabel(snapshot?.round);
  const rows = (Array.isArray(snapshot?.units) ? snapshot.units : [])
    .filter((u) => u && typeof u === "object")
    .map((u) => {
      // Definitions are a trusted label/portrait catalog. Unknown definitions never fall back to raw IDs or names.
      const definition =
        typeof u.defId === "string" && Object.hasOwn(UNIT_MAP, u.defId)
          ? UNIT_MAP[u.defId]
          : undefined;
      return {
        name: definition?.name ?? "ตัวละครไม่ทราบชื่อ",
        portrait: definition?.id,
        stars: [1, 2, 3].includes(u.star) ? u.star : 0,
        position: numeric(u.originalSlot),
        damageDealt: numeric(u.damageDealt),
        damageTaken: numeric(u.damageTaken),
        shieldAbsorbed: numeric(u.damageAbsorbed),
        skillCasts: numeric(u.skillCasts),
      } satisfies BattleStatDisplay;
    });
  rows.sort((a, b) =>
    sort === "position"
      ? (a.position ?? Infinity) - (b.position ?? Infinity)
      : (b[sort] ?? -1) - (a[sort] ?? -1),
  );
  return {
    title: recordedRound
      ? `สถิติรอบล่าสุด • ${recordedRound}`
      : "สถิติการต่อสู้ล่าสุด",
    recordedRound,
    rows,
  };
}
