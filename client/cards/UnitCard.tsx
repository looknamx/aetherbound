import {
  COLORS,
  ITEM_MAP,
  RARITIES,
  ROLE_CONFIG,
  STAT_MULT,
  TRAITS,
  UNIT_MAP,
} from "../../shared/content";
import { defenseRating, permanentStats } from "../../shared/stats";
import type { Fighter, Unit } from "../../shared/types";
import { Portrait as UnitPortrait } from "../Portrait";
export type CardVariant =
  | "shop"
  | "bench"
  | "board"
  | "detail"
  | "drag"
  | "preview";
export interface UnitCardProps {
  unit: Pick<Unit, "defId" | "star" | "items">;
  variant?: CardVariant;
  fighter?: Fighter;
  selected?: boolean;
  recommended?: boolean;
  disabled?: boolean;
  side?: "ally" | "enemy";
  affordable?: boolean;
}
export function UnitCardCornerStat({
  label,
  value,
  corner,
  detail,
  delta = 0,
}: {
  label: string;
  value: string | number;
  corner: string;
  detail?: string;
  delta?: number;
}) {
  return (
    <span
      className={`card-corner corner-${corner} ${delta > 0 ? "stat-up" : delta < 0 ? "stat-down" : ""}`}
      data-corner={corner}
      title={detail}
      aria-label={`${label} ${value}${detail ? `. ${detail}` : ""}`}
    >
      <small>{label}</small>
      <b>{value}</b>
      {delta !== 0 && (
        <i aria-label={`Modifier ${delta > 0 ? "+" : ""}${delta}`}>
          {delta > 0 ? "+" : ""}
          {delta}
        </i>
      )}
    </span>
  );
}
export function UnitStatusBars({
  hp,
  maxHp,
  mana,
  maxMana,
  combat,
}: {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  combat: boolean;
}) {
  return (
    <span className="card-bars">
      <span
        className="card-hp"
        role="meter"
        aria-label="Health"
        aria-valuenow={Math.round(hp)}
        aria-valuemin={0}
        aria-valuemax={Math.round(maxHp)}
      >
        <i
          style={{
            width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`,
          }}
        />
        <em>
          {Math.round(hp)} / {Math.round(maxHp)}
        </em>
      </span>
      {combat && (
        <span
          className="card-mana"
          role="meter"
          aria-label="Mana"
          aria-valuenow={Math.round(mana)}
          aria-valuemin={0}
          aria-valuemax={maxMana}
        >
          <i style={{ width: `${Math.min(100, (mana / maxMana) * 100)}%` }} />
        </span>
      )}
    </span>
  );
}
export function UnitItems({ items }: { items: string[] }) {
  return (
    <span
      className="card-items"
      aria-label={`${items.length} of 3 relic slots`}
    >
      {Array.from({ length: 3 }, (_, i) => (
        <span
          key={i}
          className={items[i] ? "has-item" : ""}
          title={
            items[i]
              ? `${ITEM_MAP[items[i]]?.name}: ${ITEM_MAP[items[i]]?.description}`
              : "Empty relic slot"
          }
        >
          {items[i] ? ITEM_MAP[items[i]]?.glyph : "·"}
        </span>
      ))}
    </span>
  );
}
const ORIGIN_ICONS: Record<string, string> = {
  Emberkin: "♨",
  Tideborn: "≋",
  Verdant: "❧",
  Astral: "✦",
  Ironveil: "⬡",
};
export function UnitTraits({ defId }: { defId: string }) {
  const d = UNIT_MAP[defId];
  return (
    <span className="card-traits">
      <span title={d.origin}>
        {ORIGIN_ICONS[d.origin]} <em>{d.origin}</em>
      </span>
      <span title={d.class}>
        {ROLE_CONFIG[d.role].icon} <em>{d.class}</em>
      </span>
    </span>
  );
}
export function UnitTooltip({
  unit,
  fighter,
}: {
  unit: UnitCardProps["unit"];
  fighter?: Fighter;
}) {
  const d = UNIT_MAP[unit.defId],
    s = permanentStats(unit);
  return (
    <div className="unit-tooltip">
      <strong>{d.skill.name}</strong>
      <p>
        {d.skill.description} Power{" "}
        {Math.round(d.skill.power * STAT_MULT[unit.star])}.
      </p>
      <dl>
        <div>
          <dt>Attack speed</dt>
          <dd>{(fighter?.speed ?? s.speed).toFixed(2)}/s</dd>
        </div>
        <div>
          <dt>Attack range</dt>
          <dd>{fighter?.range ?? s.range} tiles</dd>
        </div>
        <div>
          <dt>Armor</dt>
          <dd>{fighter?.armor ?? s.armor}</dd>
        </div>
        <div>
          <dt>Magic resistance</dt>
          <dd>{fighter?.resist ?? s.resist}</dd>
        </div>
        <div>
          <dt>Mana</dt>
          <dd>
            {Math.round(fighter?.mana ?? s.mana)} / {s.maxMana}
          </dd>
        </div>
        <div>
          <dt>Movement</dt>
          <dd>{s.moveSpeed} tiles/s</dd>
        </div>
        <div>
          <dt>Targeting</dt>
          <dd>{d.targeting}</dd>
        </div>
        <div>
          <dt>Base ATK / DEF</dt>
          <dd>
            {Math.round(s.attack)} / {defenseRating(s.armor, s.resist)}
          </dd>
        </div>
      </dl>
      <p>
        DEF = round((Armor + Magic Resistance) / 2). Combat still resolves each
        resistance separately.
      </p>
      <UnitTraits defId={unit.defId} />
      {TRAITS.filter((t) => t.id === d.origin || t.id === d.class).map((t) => (
        <p key={t.id}>
          <b>{t.id} · 2/4:</b> {t.description}
        </p>
      ))}
      <div className="detail-relics">
        {unit.items.length ? (
          unit.items.map((id, i) => (
            <p key={i}>
              <b>
                {ITEM_MAP[id].glyph} {ITEM_MAP[id].name}
              </b>{" "}
              — {ITEM_MAP[id].description}
            </p>
          ))
        ) : (
          <p>No equipped relics · three slots available</p>
        )}
      </div>
    </div>
  );
}
/** Presentational only: every context gets the same definition and shared stat calculation. */
export function UnitCard({
  unit,
  variant = "shop",
  fighter,
  selected,
  recommended,
  disabled,
  side,
  affordable = true,
}: UnitCardProps) {
  const d = UNIT_MAP[unit.defId],
    s = permanentStats(unit),
    role = ROLE_CONFIG[d.role];
  const attack = Math.round(fighter?.attack ?? s.attack),
    armor = fighter?.armor ?? s.armor,
    resist = fighter?.resist ?? s.resist,
    def = defenseRating(armor, resist);
  const hp = fighter?.hp ?? s.maxHp,
    maxHp = fighter?.maxHp ?? s.maxHp;
  const status = [
    ...(fighter?.status ?? []),
    ...(fighter?.shield ? ["Shield"] : []),
    ...(fighter?.summon ? ["Echo"] : []),
  ];
  return (
    <span
      className={`unit-card unit-card--${variant} ${selected ? "is-selected" : ""} ${recommended ? "is-recommended" : ""} ${disabled ? "is-disabled" : ""} ${side ? `side-${side}` : ""} ${hp <= 0 ? "is-defeated" : ""}`}
      data-def={d.id}
      data-star={unit.star}
      data-variant={variant}
      style={
        {
          "--rarity": COLORS[d.cost - 1],
          "--role-color": role.color,
        } as React.CSSProperties
      }
    >
      <span className="card-face">
        <UnitCardCornerStat
          label="ATK"
          value={attack}
          corner="tl"
          delta={attack - Math.round(s.attack)}
          detail={`Permanent attack ${Math.round(s.attack)}; includes star and relics`}
        />
        <UnitCardCornerStat
          label="DEF"
          value={def}
          corner="tr"
          delta={def - defenseRating(s.armor, s.resist)}
          detail={`Armor ${armor}; Magic Resistance ${resist}; equal-weight average`}
        />
        <span className="card-center">
          <span className="card-art">
            <UnitPortrait id={d.id} />
          </span>
          <strong className="card-name" title={d.name}>
            <span className="full-name">{d.name}</span>
            <span className="short-name">{d.name.split(/[ ,]/)[0]}</span>
          </strong>
          <span className="card-stars" aria-label={`${unit.star} stars`}>
            {"★".repeat(unit.star)}
          </span>
          <UnitTraits defId={d.id} />
          <UnitStatusBars
            hp={hp}
            maxHp={maxHp}
            mana={fighter?.mana ?? s.mana}
            maxMana={fighter?.maxMana ?? s.maxMana}
            combat={!!fighter}
          />
          <UnitItems items={unit.items} />
        </span>
        <span
          className="card-role card-corner corner-bl"
          data-corner="bl"
          title={d.role}
          aria-label={`Role ${d.role}`}
        >
          <b>{role.icon}</b>
          <span className="full-role">{d.role}</span>
          <span className="short-role">{role.short}</span>
        </span>
        <UnitCardCornerStat
          label={`${RARITIES[d.cost - 1]}`}
          value={`${d.cost} ◉`}
          corner="br"
          detail={`Cost ${d.cost}; ${RARITIES[d.cost - 1]}`}
        />
        {status.length > 0 && (
          <span className="card-status" aria-label={status.join(", ")}>
            {status.map((s) => (
              <abbr key={s} title={s}>
                {s === "Shield"
                  ? `◇${Math.round(fighter!.shield)}`
                  : s === "Stun"
                    ? "STN"
                    : s === "Silence"
                      ? "SIL"
                      : s === "Slow"
                        ? "SLOW"
                        : s}
              </abbr>
            ))}
          </span>
        )}
        {side && (
          <span className="card-team">{side === "ally" ? "ALLY" : "FOE"}</span>
        )}
        {recommended && (
          <span
            className="auto-pick"
            title="The server currently recommends this recruit for auto-deploy"
          >
            ↗ AUTO
          </span>
        )}
      </span>
      {variant === "shop" && (
        <span className={`card-buy-state ${!affordable ? "too-poor" : ""}`}>
          {affordable ? "Recruit card" : "Not enough gold"}
        </span>
      )}
      {variant === "detail" && <UnitTooltip unit={unit} fighter={fighter} />}
    </span>
  );
}
