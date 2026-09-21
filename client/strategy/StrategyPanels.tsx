import { useEffect, useState, type ReactNode } from "react";
import { AUGMENT_MAP, DIFFICULTY } from "../../shared/strategyConfig";
import { ITEM_MAP } from "../../shared/content";
import { itemCandidates, suggestedRole } from "../../shared/choices";
import { synergyAdvice } from "../../shared/roundInsights";
import type { Action, Phase, Player } from "../../shared/types";
import type { Difficulty, ScoutingView } from "../../shared/strategyTypes";
import { UnitCard } from "../cards/UnitCard";
import {
  LABELS,
  TRAIT_NAMES,
  ROLE_NAMES,
  ITEM_TEXT,
  INCOME_LABELS,
  type Locale,
} from "./labels";
import "./strategy.css";
export function PracticeEntry({
  locale,
  disabled,
  onStart,
}: {
  locale: Locale;
  disabled: boolean;
  onStart: (difficulty: Difficulty) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal"),
    l = LABELS[locale];
  return (
    <section className="practice-entry">
      <label>
        {l.difficulty}
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
        >
          {(["easy", "normal", "hard"] as const).map((d) => (
            <option key={d} value={d}>
              {locale === "th" ? DIFFICULTY[d].label : DIFFICULTY[d].en}
            </option>
          ))}
        </select>
      </label>
      <button disabled={disabled} onClick={() => onStart(difficulty)}>
        {l.practice}
      </button>
      <small>{l.fair}</small>
    </section>
  );
}
export function ScoutingPanel({
  views,
  ownSeat,
  phase,
  locale,
  children,
}: {
  views: ScoutingView[];
  ownSeat: number;
  phase: Phase;
  locale: Locale;
  children: ReactNode;
}) {
  const [seat, setSeat] = useState<number>(),
    l = LABELS[locale];
  useEffect(() => {
    if (phase !== "Preparing") setSeat(undefined);
  }, [phase]);
  const target =
    phase === "Preparing" ? views.find((v) => v.seat === seat) : undefined;
  return (
    <section className="scouting">
      <nav aria-label={l.scout}>
        {phase === "Preparing" &&
          views
            .filter((v) => v.seat !== ownSeat)
            .map((v) => (
              <button
                key={v.seat}
                aria-pressed={seat === v.seat}
                onClick={() => setSeat(v.seat)}
              >
                {v.name}
                {v.eliminated
                  ? " · " + l.out
                  : !v.connected
                    ? " · " + l.offline
                    : ""}
              </button>
            ))}
        {target && <button onClick={() => setSeat(undefined)}>{l.own}</button>}
      </nav>
      {target ? (
        <>
          <h3>
            {l.watch} {target.name}
          </h3>
          <p>
            {target.hp} HP · {l.level} {target.level} · {l.ownStock}
          </p>
          <div
            className="scout-grid"
            role="img"
            aria-label={l.watch + " " + target.name}
          >
            {Array.from({ length: 36 }, (_, slot) => {
              const u = target.units.find((u) => u.slot === slot);
              return (
                <div className={slot < 18 ? "scout-enemy" : ""} key={slot}>
                  {u && <UnitCard unit={u} variant="board" />}
                </div>
              );
            })}
          </div>
          <ul>
            {target.traits.map((t) => (
              <li key={t.name}>
                {TRAIT_NAMES[t.name]?.[locale] ?? l.traits} · {t.count} ·{" "}
                {l.tier} {t.tier}
                {t.needed > 0 ? " · " + l.next + " " + t.needed : ""}
              </li>
            ))}
          </ul>
          <AugmentList ids={target.augments} locale={locale} />
        </>
      ) : (
        children
      )}
    </section>
  );
}
export function AugmentList({
  ids,
  locale,
}: {
  ids: string[];
  locale: Locale;
}) {
  return (
    <details className="strategy-panel">
      <summary>
        {LABELS[locale].owned} ({ids.length})
      </summary>
      {ids.map(
        (id) =>
          AUGMENT_MAP[id] && (
            <p key={id}>
              <strong>
                {locale === "th" ? AUGMENT_MAP[id].name : AUGMENT_MAP[id].en}
              </strong>{" "}
              ·{" "}
              {locale === "th"
                ? AUGMENT_MAP[id].description
                : AUGMENT_MAP[id].descriptionEn}
            </p>
          ),
      )}
    </details>
  );
}
export function ChoicePanel({
  player,
  locale,
  disabled,
  onAction,
}: {
  player: Player;
  locale: Locale;
  disabled: boolean;
  onAction: (action: Action) => void;
}) {
  const l = LABELS[locale];
  return (
    <section className="strategy-panel choices" aria-label={l.choices}>
      <h2>{l.choices}</h2>
      <p>{l.timeout}</p>
      {(["item", "augment"] as const).map((kind) => {
        const choice = player.pendingChoices?.[kind];
        if (!choice) return null;
        return (
          <section key={kind}>
            <h3>{l[kind]}</h3>
            <div className="choice-grid">
              {choice.options.map((id, index) => {
                const item = kind === "item" ? ITEM_MAP[id] : undefined,
                  aug = kind === "augment" ? AUGMENT_MAP[id] : undefined;
                return (
                  <button
                    key={index}
                    disabled={disabled}
                    onClick={() =>
                      onAction({
                        type: "choose",
                        kind,
                        round: choice.round,
                        index,
                      })
                    }
                  >
                    <strong>
                      {item
                        ? item.glyph + " " + item.name
                        : aug
                          ? locale === "th"
                            ? aug.name
                            : aug.en
                          : l.empty}
                    </strong>
                    <p>
                      {item
                        ? locale === "th"
                          ? ITEM_TEXT[id]
                          : item.description
                        : aug
                          ? locale === "th"
                            ? aug.description
                            : aug.descriptionEn
                          : ""}
                    </p>
                    {item && (
                      <>
                        <small>
                          {l.rarity}: {item.passive ? l.rare : l.common}
                        </small>
                        <small>
                          {l.role}: {ROLE_NAMES[suggestedRole(id)]?.[locale]}
                        </small>
                        <small>
                          {l.recommend}:{" "}
                          {itemCandidates(player, id).join(", ") ||
                            ROLE_NAMES[suggestedRole(id)]?.[locale]}
                        </small>
                      </>
                    )}
                    {aug && <small>{l.duration}</small>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {!player.pendingChoices?.item && !player.pendingChoices?.augment && (
        <p role="status">{l.waiting}</p>
      )}
      {!!player.rewardOverflow?.length && (
        <p>
          {l.overflow}: {player.rewardOverflow.length}
        </p>
      )}
    </section>
  );
}
export function SynergyHint({
  player,
  defId,
  locale,
}: {
  player: Player;
  defId: string;
  locale: Locale;
}) {
  const l = LABELS[locale],
    advice = synergyAdvice(player, defId);
  return (
    <div className="synergy-hints">
      {advice.map((a) => (
        <p key={a.trait} className={"synergy-" + a.kind}>
          {a.kind === "activate"
            ? "◆ "
            : a.kind === "upgrade"
              ? "↑ "
              : a.kind === "progress"
                ? "+ "
                : "— "}
          {a.duplicate
            ? l.duplicate
            : l[a.kind === "none" ? "duplicate" : a.kind]}{" "}
          · {TRAIT_NAMES[a.trait]?.[locale]} {a.current} → {a.next}
          {a.threshold ? " / " + a.threshold : ""}
        </p>
      ))}
      {advice.some((a) => a.needsReplacement && !a.duplicate) && (
        <small>{l.replace}</small>
      )}
    </div>
  );
}
export function RoundInsights({
  player,
  locale,
}: {
  player: Player;
  locale: Locale;
}) {
  const l = LABELS[locale],
    income = player.latestIncome,
    s = player.latestSummary;
  return (
    <section className="round-insights">
      {income && (
        <details className="strategy-panel" open>
          <summary>
            {l.income} · {l.round} {income.round}
          </summary>
          <dl>
            {(
              Object.keys(
                INCOME_LABELS[locale],
              ) as (keyof typeof INCOME_LABELS.th)[]
            ).map((key) => (
              <div key={key}>
                <dt>{INCOME_LABELS[locale][key]}</dt>
                <dd>
                  {key === "capped" ? "−" : "+"}
                  {income[key]}
                </dd>
              </div>
            ))}
          </dl>
          <strong>
            {l.total} +{income.total}
          </strong>
          <p>
            {l.gold}: {income.before} → {income.after}
          </p>
        </details>
      )}
      {s && (
        <details className="strategy-panel">
          <summary>
            {l.summary} · {l.round} {s.round} ·{" "}
            {
              {
                th: { win: "ชนะ", loss: "แพ้", draw: "เสมอ" },
                en: { win: "Victory", loss: "Defeat", draw: "Draw" },
              }[locale][s.result]
            }
          </summary>
          {s.topDamage && (
            <p>
              {l.topDamage}: {s.topDamage.name} ·{" "}
              {s.topDamage.amount.toLocaleString()}
            </p>
          )}
          {s.topTaken && (
            <p>
              {l.topTaken}: {s.topTaken.name} ·{" "}
              {s.topTaken.amount.toLocaleString()}
            </p>
          )}
          <p>
            {l.casts}: {s.casts} · {l.shields}:{" "}
            {s.shieldsGranted.toLocaleString()} · {l.broken}: {s.shieldsBroken}
          </p>
          <p>
            {l.survivors}: {s.survivors} · {l.hpLoss}: {s.playerDamage}
          </p>
          {[
            { label: l.traits, traits: s.ownTraits },
            { label: l.enemy, traits: s.enemyTraits },
          ].map((t) => (
            <p key={t.label}>
              {t.label}:{" "}
              {t.traits
                .map(
                  (t) =>
                    (TRAIT_NAMES[t.name]?.[locale] ?? "") +
                    " " +
                    l.tier +
                    " " +
                    t.tier,
                )
                .join(" · ") || "—"}
            </p>
          ))}
          <AugmentList ids={s.augments} locale={locale} />
        </details>
      )}
    </section>
  );
}
