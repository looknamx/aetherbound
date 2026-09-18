import { useState } from "react";
import type { BattleStatsSnapshot } from "../../shared/types";
import { sortBattleStats, type StatsSort } from "../../shared/battleStats";
import { Portrait } from "../Portrait";
import "./battleStats.css";
export const formatDamage = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` : Math.round(n).toString();
export function LatestBattleStatsPanel({
  snapshot,
  battling,
  round,
}: {
  snapshot?: BattleStatsSnapshot;
  battling: boolean;
  round: number;
}) {
  const [sort, setSort] = useState<StatsSort>("damageDealt");
  const rows = sortBattleStats(snapshot?.units ?? [], sort);
  const maxDealt = Math.max(1, ...rows.map((u) => u.damageDealt));
  const maxTaken = Math.max(1, ...rows.map((u) => u.damageTaken));
  return (
    <details className="latest-stats" open>
      <summary>
        สถิติรอบล่าสุด {snapshot && <span> · Round {snapshot.round}</span>}
      </summary>
      {battling && (
        <p>กำลังต่อสู้รอบ {round} · ผลรอบนี้จะแสดงเมื่อจบการต่อสู้</p>
      )}
      {!snapshot ? (
        <p>— ยังไม่มีข้อมูลการต่อสู้</p>
      ) : (
        <>
          <label>
            เรียงตาม{" "}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as StatsSort)}
            >
              <option value="damageDealt">Damage Dealt</option>
              <option value="damageTaken">Damage Taken</option>
              <option value="position">ตำแหน่งเดิมในทีม</option>
            </select>
          </label>
          {!rows.length && <p>ไม่มีตัวละครเข้าร่วมในรอบนี้</p>}
          <ol>
            {rows.map((u) => (
              <li key={u.combatUnitId}>
                <div className="stats-recruit">
                  <Portrait id={u.portrait} />
                  <strong>
                    {u.name}{" "}
                    <span aria-label={`${u.star} stars`}>
                      {"★".repeat(u.star)}
                    </span>
                  </strong>
                </div>
                {(
                  [
                    ["Damage Dealt", u.damageDealt, maxDealt, "dealt"],
                    ["Damage Taken", u.damageTaken, maxTaken, "taken"],
                  ] as const
                ).map(([label, value, max, kind]) => (
                  <div
                    key={kind}
                    className={`stats-meter ${kind}`}
                    title={`${label}: ${value.toLocaleString("en-US", { maximumFractionDigits: 8 })}`}
                  >
                    <span>{label}</span>
                    <strong>{formatDamage(value)}</strong>
                    <meter
                      aria-label={`${u.name} ${label}`}
                      min={0}
                      max={max}
                      value={value}
                    />
                  </div>
                ))}
                <details>
                  <summary>ค่าจริง / รายละเอียด</summary>
                  <p>
                    Damage Dealt: {u.damageDealt} · Damage Taken:{" "}
                    {u.damageTaken}
                  </p>
                  <p>
                    Round {snapshot.round} · {u.unitId} · {snapshot.battleId}
                  </p>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
    </details>
  );
}
