import { useId, useState } from "react";
import type { BattleStatsSnapshot } from "../../shared/types";
import { Portrait } from "../Portrait";
import {
  battleStatsDisplay,
  exactDamage,
  formatDamage,
  roundLabel,
  STAT_LABELS,
  type BattleStatDisplay,
  type DisplaySort,
} from "./battleStatsDisplay";
import "./battleStats.css";
export { formatDamage } from "./battleStatsDisplay";

function StatDetails({
  row,
  recordedRound,
}: {
  row: BattleStatDisplay;
  recordedRound?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const fields = [
    ...(formatDamage(row.damageDealt) !== exactDamage(row.damageDealt)
      ? [{ label: STAT_LABELS.damageDealt, value: row.damageDealt }]
      : []),
    ...(formatDamage(row.damageTaken) !== exactDamage(row.damageTaken)
      ? [{ label: STAT_LABELS.damageTaken, value: row.damageTaken }]
      : []),
    { label: STAT_LABELS.absorbed, value: row.shieldAbsorbed },
    { label: STAT_LABELS.casts, value: row.skillCasts },
  ].filter((field) => field.value !== undefined);
  return (
    <div className="stat-details">
      <button
        type="button"
        className="stat-details-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        aria-label={`${STAT_LABELS.details} ${row.name}`}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!event.repeat) setExpanded((value) => !value);
          }
        }}
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>{" "}
        {STAT_LABELS.details}
      </button>
      <div id={id} hidden={!expanded}>
        {recordedRound && <p>บันทึกจาก{recordedRound}</p>}
        {fields.length ? (
          <dl>
            {fields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{exactDamage(field.value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>ค่าด้านบนแสดงค่าจริงแล้ว ไม่มีรายละเอียดเพิ่มเติม</p>
        )}
      </div>
    </div>
  );
}
export function LatestBattleStatsPanel({
  snapshot,
  battling,
  round,
}: {
  snapshot?: BattleStatsSnapshot;
  battling: boolean;
  round: number;
}) {
  const [sort, setSort] = useState<DisplaySort>("damageDealt");
  const display = battleStatsDisplay(snapshot, sort);
  const currentRound = roundLabel(round);
  const maxDealt = Math.max(1, ...display.rows.map((u) => u.damageDealt ?? 0));
  const maxTaken = Math.max(1, ...display.rows.map((u) => u.damageTaken ?? 0));
  return (
    <details className="latest-stats" lang="th" open>
      <summary>{display.title}</summary>
      {battling && (
        <p>
          {currentRound ? `กำลังต่อสู้${currentRound}` : "กำลังต่อสู้"} ·
          ผลรอบนี้จะแสดงเมื่อจบการต่อสู้
        </p>
      )}
      {!snapshot ? (
        <p>— {STAT_LABELS.missing}</p>
      ) : (
        <>
          <label>
            เรียงตาม{" "}
            <select
              value={sort}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "damageDealt" ||
                  value === "damageTaken" ||
                  value === "position"
                )
                  setSort(value);
              }}
            >
              <option value="damageDealt">{STAT_LABELS.damageDealt}</option>
              <option value="damageTaken">{STAT_LABELS.damageTaken}</option>
              <option value="position">{STAT_LABELS.position}</option>
            </select>
          </label>
          {!display.rows.length && (
            <p>{STAT_LABELS.missing} · ไม่มีตัวละครเข้าร่วมในรอบนี้</p>
          )}
          <ol>
            {display.rows.map((row, index) => (
              <li key={index}>
                <div className="stats-recruit">
                  {row.portrait && <Portrait id={row.portrait} />}
                  <strong>
                    {row.name}{" "}
                    <span aria-label={`${row.stars} ดาว`}>
                      {"★".repeat(row.stars)}
                    </span>
                  </strong>
                </div>
                {(
                  [
                    [
                      STAT_LABELS.damageDealt,
                      row.damageDealt,
                      maxDealt,
                      "dealt",
                    ],
                    [
                      STAT_LABELS.damageTaken,
                      row.damageTaken,
                      maxTaken,
                      "taken",
                    ],
                  ] as const
                ).map(([label, value, max, kind]) => (
                  <div
                    key={kind}
                    className={`stats-meter ${kind}`}
                    title={`${label}: ${exactDamage(value)}`}
                  >
                    <span>{label}</span>
                    <strong>{formatDamage(value)}</strong>
                    {value !== undefined && (
                      <meter
                        aria-label={`${row.name} ${label}`}
                        aria-valuetext={exactDamage(value)}
                        min={0}
                        max={max}
                        value={value}
                      />
                    )}
                  </div>
                ))}
                <StatDetails row={row} recordedRound={display.recordedRound} />
              </li>
            ))}
          </ol>
        </>
      )}
    </details>
  );
}
