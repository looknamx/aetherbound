import { useState } from "react";
import { UNIT_MAP } from "../../shared/content";
import type { BattleStatsSnapshot } from "../../shared/types";
import type { Locale } from "../strategy/labels";
const fields = {
  th: {
    damageDealt: "ความเสียหายที่ทำ",
    damageTaken: "ความเสียหายที่รับ",
    healingDone: "ฟื้นฟู",
    shieldGranted: "โล่ที่ให้",
  },
  en: {
    damageDealt: "Damage dealt",
    damageTaken: "Damage taken",
    healingDone: "Healing",
    shieldGranted: "Shield granted",
  },
};
export function TeamStatistics({
  snapshot,
  locale,
}: {
  snapshot?: BattleStatsSnapshot;
  locale: Locale;
}) {
  const [sort, setSort] = useState<keyof typeof fields.en>("damageDealt"),
    l = fields[locale];
  const value = (n: number) => (Number.isFinite(n) && n >= 0 ? n : 0);
  const rows = (snapshot?.units ?? [])
    .map((u) => ({
      name:
        UNIT_MAP[u.defId]?.name ??
        (locale === "th" ? "ตัวละครไม่ทราบชื่อ" : "Unknown recruit"),
      star: u.star,
      damageDealt: value(u.damageDealt),
      damageTaken: value(u.damageTaken),
      healingDone: value(u.healingDone),
      shieldGranted: value(u.shieldGranted),
    }))
    .sort((a, b) => b[sort] - a[sort]);
  return (
    <div className="hud-statistics">
      {snapshot && (
        <p>
          {locale === "th" ? "รอบ" : "Round"} {snapshot.round}
        </p>
      )}
      <label>
        {locale === "th" ? "เรียงตาม" : "Sort by"}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          {Object.entries(l).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              <th>{locale === "th" ? "ตัวละคร" : "Recruit"}</th>
              {Object.values(l).map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => (
              <tr key={i}>
                <th>
                  {u.name} {"★".repeat(u.star)}
                </th>
                {(Object.keys(l) as (keyof typeof l)[]).map((key) => (
                  <td key={key}>
                    {u[key].toLocaleString(
                      locale === "th" ? "th-TH" : "en-US",
                      { maximumFractionDigits: 1 },
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{locale === "th" ? "ยังไม่มีข้อมูล" : "No data yet"}</p>
      )}
    </div>
  );
}
