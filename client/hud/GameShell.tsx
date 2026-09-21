import { TeamStatistics } from "./TeamStatistics";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Action, Snapshot } from "../../shared/types";
import { ITEM_MAP, UNIT_MAP, XP_TO_LEVEL, RULES } from "../../shared/content";
import { AUGMENT_MAP } from "../../shared/strategyConfig";
import { synergies } from "../../shared/economy";
import { eventLabel } from "../../shared/combatEvents";
import {
  ChoicePanel,
  AugmentList,
  RoundInsights,
} from "../strategy/StrategyPanels";
import { TRAIT_NAMES, type Locale } from "../strategy/labels";
import { UnitCard } from "../cards/UnitCard";
import { Overlay } from "./Overlay";
import { HUD } from "./labels";
import "./hud.css";

type Panel =
  | "shop"
  | "items"
  | "bonuses"
  | "stats"
  | "summary"
  | "guide"
  | "settings"
  | "players"
  | "context";
export function overlayPriority(
  connected: boolean,
  phase: string,
  item: boolean,
  augment: boolean,
  voluntary?: string,
) {
  return !connected
    ? "connection"
    : phase === "Finished"
      ? "finished"
      : item
        ? "item"
        : augment
          ? "augment"
          : voluntary;
}
interface Props {
  state: Snapshot;
  locale: Locale;
  connected: boolean;
  pending: boolean;
  remaining: number;
  interactionHint?: string;
  board: ReactNode;
  bench: ReactNode;
  shop: ReactNode;
  context: ReactNode;
  items: ReactNode;
  settings: ReactNode;
  guide: ReactNode;
  detail?: ReactNode;
  clearDetail: () => void;
  onAction: (a: Action) => unknown;
  onHome: () => void;
  onAgain: () => void;
}
export function TopHud({
  state,
  locale,
  connected,
  remaining,
  onSettings,
}: {
  state: Snapshot;
  locale: Locale;
  connected: boolean;
  remaining: number;
  onSettings: () => void;
}) {
  const p = state.room.players.find((p) => p.id === state.you)!,
    r = state.room,
    l = HUD[locale];
  const phase = {
    Lobby: l.lobby,
    Preparing: l.prep,
    Battling: l.battle,
    Resolving: l.resolving,
    Choosing: l.choosing,
    Finished: l.finished,
  }[r.phase];
  return (
    <div className="top-hud">
      <div className="hud-brand">
        <b>◈ AETHERBOUND</b>
        <small>{r.mode === "practice" ? "Practice" : r.key}</small>
      </div>
      <strong className="hud-health">♥ {p.hp}</strong>
      <div className="hud-phase">
        <b>
          {l.round} {r.round} · {phase}
        </b>
        <strong
          className={
            remaining < 10 && r.deadline ? "hud-timer urgent" : "hud-timer"
          }
          role="timer"
        >
          {r.deadline ? remaining + "s" : "—"}
        </strong>
      </div>
      <strong className="hud-gold" data-testid="gold">
        ◉ {p.gold} <small>{l.gold}</small>
      </strong>
      <div className="hud-level">
        <b>
          {l.level} {p.level}
        </b>
        <span>
          {p.xp}/{XP_TO_LEVEL[p.level] ?? "MAX"} XP ·{" "}
          {p.units.filter((u) => u.slot < 36).length}/{p.level} ◇
        </span>
        <progress
          aria-label="XP"
          value={p.level === 8 ? 1 : p.xp}
          max={p.level === 8 ? 1 : XP_TO_LEVEL[p.level]}
        />
      </div>
      <span
        className={"hud-connection " + (connected ? "online" : "")}
        title={connected ? l.connected : l.reconnect}
      >
        ● <span>{connected ? l.connected : l.reconnect}</span>
      </span>
      <button aria-label={l.settings} onClick={onSettings}>
        ⚙
      </button>
    </div>
  );
}
export function GameShell(props: Props) {
  const { state, locale, connected, pending, remaining } = props,
    r = state.room,
    p = r.players.find((p) => p.id === state.you)!,
    l = HUD[locale];
  const [panel, setPanel] = useState<Panel>(),
    [seat, setSeat] = useState<number>(),
    [collapsed, setCollapsed] = useState(false),
    [tab, setTab] = useState("result"),
    [confirmation, setConfirmation] = useState("");
  const [seenSummary, setSeenSummary] = useState(0);
  const [choiceBusy, setChoiceBusy] = useState(false),
    choiceLock = useRef(false),
    previousChoice = useRef<
      { key: string; id: string; kind: "item" | "augment" } | undefined
    >(undefined),
    manual = useRef<string | undefined>(undefined);
  const item =
      r.phase === "Choosing" && p.hp > 0 ? p.pendingChoices?.item : undefined,
    augment =
      r.phase === "Choosing" && p.hp > 0
        ? p.pendingChoices?.augment
        : undefined;
  const choiceKey = item
    ? "item:" + item.round
    : augment
      ? "augment:" + augment.round
      : "";
  const active = overlayPriority(
    connected,
    r.phase,
    !!item,
    !!augment,
    props.detail ? "detail" : panel,
  );
  useEffect(() => {
    if (r.phase !== "Preparing") {
      setSeat(undefined);
      setPanel((old) => (old === "shop" ? undefined : old));
    }
  }, [r.phase]);
  useEffect(() => {
    if (choiceKey !== previousChoice.current?.key) {
      if (previousChoice.current) {
        const old = previousChoice.current,
          id = manual.current ?? old.id;
        setConfirmation(
          (manual.current ? l.selected : l.automatic) +
            " · " +
            (old.kind === "item"
              ? ITEM_MAP[id]?.name
              : locale === "th"
                ? AUGMENT_MAP[id]?.name
                : AUGMENT_MAP[id]?.en),
        );
      }
      choiceLock.current = false;
      setChoiceBusy(false);
      manual.current = undefined;
    }
    previousChoice.current = choiceKey
      ? {
          key: choiceKey,
          id: (item ?? augment)!.options[0],
          kind: item ? "item" : "augment",
        }
      : undefined;
  }, [choiceKey]);
  useEffect(() => {
    if (confirmation) {
      const timer = setTimeout(() => setConfirmation(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [confirmation]);
  const choose = async (a: Action) => {
    if (choiceLock.current || pending) return;
    choiceLock.current = true;
    setChoiceBusy(true);
    if (a.type === "choose")
      manual.current = p.pendingChoices?.[a.kind]?.options[a.index];
    try {
      const result = await props.onAction(a);
      if (
        result &&
        typeof result === "object" &&
        "ok" in result &&
        !result.ok
      ) {
        choiceLock.current = false;
        setChoiceBusy(false);
        manual.current = undefined;
      }
    } catch {
      choiceLock.current = false;
      setChoiceBusy(false);
      manual.current = undefined;
    }
  };
  const scout =
    r.phase === "Preparing"
      ? state.scouting?.find((v) => v.seat === seat)
      : undefined;
  const close = () => {
    if (active === "detail") props.clearDetail();
    else setPanel(undefined);
  };
  const open = (next: Panel) => {
    if (item || augment || !connected || r.phase === "Finished") return;
    setPanel(next);
    if (next === "summary" || next === "stats")
      setSeenSummary(p.latestSummary?.round ?? 0);
    if (next === "stats") setTab("stats");
    if (next === "summary") setTab("result");
  };
  const roster = (
    <>
      <h3>{l.players}</h3>
      {r.players.map((other, index) => (
        <button
          className={"hud-player " + (other.id === p.id ? "self" : "")}
          key={other.id}
          disabled={r.phase !== "Preparing" || other.id === p.id}
          onClick={() => {
            setSeat(index);
            setPanel(undefined);
          }}
          title={other.name}
        >
          <span>
            {other.name}
            <small>
              {!other.connected
                ? l.reconnect
                : other.hp <= 0
                  ? "#" + other.rank
                  : l.level + " " + other.level}
            </small>
          </span>
          <b>♥ {other.hp}</b>
          <span aria-hidden="true">◎</span>
        </button>
      ))}
      <h3>{l.traits}</h3>
      <div className="hud-traits">
        {synergies(p.units)
          .filter((t) => t.count > 0)
          .map((t) => (
            <div
              key={t.id}
              className={t.tier ? "active" : ""}
              title={t.description}
            >
              <span>
                {t.tier ? "◆" : "◇"} {TRAIT_NAMES[t.id]?.[locale] ?? t.id}
              </span>
              <b>
                {t.count}/
                {t.thresholds.find((n) => n > t.count) ?? t.thresholds.at(-1)}
              </b>
            </div>
          ))}
      </div>
    </>
  );
  const liveEvents = r.battles
    .filter((b) => b.a === p.id || b.b === p.id)
    .flatMap((b) =>
      b.frames
        .filter(
          (f) =>
            r.phase !== "Battling" ||
            f.tick * RULES.tickMs <=
              (Date.now() - (b.startedAt ?? Date.now())) *
                (b.playbackRate ?? 1),
        )
        .flatMap((f) =>
          f.events
            .filter((e) => ["cast", "death", "shieldBreak"].includes(e.type))
            .map((e) => eventLabel(e, f, locale)),
        ),
    )
    .filter((s): s is string => !!s)
    .slice(-100);
  const events =
    r.phase === "Battling"
      ? liveEvents
      : (p.latestSummary?.events
          ?.map((e) => {
            const source = UNIT_MAP[e.sourceDefId],
              target = e.targetDefId ? UNIT_MAP[e.targetDefId] : undefined;
            if (!source) return "";
            return e.type === "cast"
              ? source.name + " · " + source.skill.name
              : e.type === "shieldBreak"
                ? source.name +
                  " · " +
                  (locale === "th" ? "โล่แตก" : "Shield broken")
                : source.name +
                  " · " +
                  (locale === "th" ? "ถูกกำจัด" : "Defeated") +
                  (target ? " · " + target.name : "");
          })
          .filter(Boolean) ?? liveEvents);
  let content: ReactNode,
    title = "",
    variant: "modal" | "bottom" | "side" = "modal";
  if (active === "connection") {
    title = l.reconnect;
    content = <p>{l.waiting}</p>;
  } else if (active === "finished") {
    title = l.finished;
    content = (
      <>
        <div className="hud-ranking">
          {[...r.players]
            .sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))
            .map((other) => (
              <p key={other.id}>
                #{other.rank} · {other.name} · {other.hp} HP
              </p>
            ))}
        </div>
        <button disabled={pending} onClick={props.onAgain}>
          {l.again}
        </button>
        <button onClick={props.onHome}>{l.home}</button>
      </>
    );
  } else if (active === "item" || active === "augment") {
    title = active === "item" ? l.itemChoice : l.augmentChoice;
    content = (
      <>
        <strong className="hud-choice-timer">{remaining}s</strong>
        <ChoicePanel
          player={{
            ...p,
            pendingChoices: active === "item" ? { item } : { augment },
          }}
          locale={locale}
          disabled={pending || choiceBusy}
          onAction={(a) => void choose(a)}
        />
      </>
    );
  } else if (active === "shop") {
    title = l.shop + " · ◉ " + p.gold;
    variant = "bottom";
    content = props.shop;
  } else if (active === "items") {
    title = l.items;
    variant = "side";
    content = (
      <div
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-item]"))
            setPanel(undefined);
        }}
      >
        {props.items}
      </div>
    );
  } else if (active === "bonuses") {
    title = l.bonuses;
    content = <AugmentList ids={p.augments ?? []} locale={locale} />;
  } else if (active === "settings") {
    title = l.settings;
    content = props.settings;
  } else if (active === "guide") {
    title = l.guide;
    content = props.guide;
  } else if (active === "detail") {
    title = l.inspect;
    variant = "side";
    content = props.detail;
  } else if (active === "players") {
    title = l.players;
    variant = "side";
    content = roster;
  } else if (active === "context") {
    title = l.context;
    variant = "side";
    content = props.context;
  } else if (active === "stats" || active === "summary") {
    title = l.summary;
    content = (
      <>
        <div className="summary-tabs" role="tablist">
          {(["result", "stats", "income", "events"] as const).map((t) => (
            <button
              role="tab"
              aria-selected={tab === t}
              aria-controls="round-tab"
              id={"tab-" + t}
              key={t}
              onClick={() => setTab(t)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  const tabs = ["result", "stats", "income", "events"],
                    next =
                      tabs[
                        (tabs.indexOf(t) + (e.key === "ArrowRight" ? 1 : 3)) % 4
                      ];
                  setTab(next);
                  document.getElementById("tab-" + next)?.focus();
                }
              }}
            >
              {l[t]}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="round-tab" aria-labelledby={"tab-" + tab}>
          {tab === "result" && p.latestSummary?.opponentName && (
            <p>
              {locale === "th" ? "คู่ต่อสู้" : "Opponent"}:{" "}
              {p.latestSummary.opponentName}
            </p>
          )}
          {tab === "stats" ? (
            <TeamStatistics snapshot={p.latestBattleStats} locale={locale} />
          ) : tab === "events" ? (
            <div className="hud-events">
              {events.length
                ? events.map((line, i) => <p key={i}>{line}</p>)
                : l.empty}
            </div>
          ) : (
            <RoundInsights
              player={{
                ...p,
                latestIncome: tab === "income" ? p.latestIncome : undefined,
                latestSummary: tab === "result" ? p.latestSummary : undefined,
              }}
              locale={locale}
            />
          )}
        </div>
      </>
    );
  }
  return (
    <main
      className={"game-shell " + (collapsed ? "sidebar-collapsed" : "")}
      data-phase={r.phase}
    >
      <TopHud
        state={state}
        locale={locale}
        connected={connected}
        remaining={remaining}
        onSettings={() => open("settings")}
      />
      <div className="hud-middle">
        <aside className="hud-left">
          <button
            className="hud-collapse"
            aria-label={l.collapse}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "»" : "«"}
          </button>
          {!collapsed && roster}
        </aside>
        <section className="board-viewport">
          <div className="hud-board-label">
            <span>
              {scout ? l.view + " · " + scout.name : l.own + " · " + p.name}
            </span>
            {scout && (
              <button onClick={() => setSeat(undefined)}>{l.own}</button>
            )}
          </div>
          <div className="board-fit">
            {scout ? (
              <div
                className="hud-scout"
                role="grid"
                aria-label={l.view + " " + scout.name}
              >
                {Array.from({ length: 36 }, (_, slot) => {
                  const u = scout.units.find((u) => u.slot === slot);
                  return (
                    <div
                      role="gridcell"
                      className={slot < 18 ? "enemy-zone" : "own-zone"}
                      key={slot}
                    >
                      {u && <UnitCard unit={u} variant="board" />}
                    </div>
                  );
                })}
              </div>
            ) : (
              props.board
            )}
          </div>
          <div className="hud-board-caption" title={props.interactionHint}>
            {r.phase === "Resolving"
              ? p.lastResult
              : r.phase === "Battling"
                ? l.battle
                : scout
                  ? scout.hp + " HP · " + l.level + " " + scout.level
                  : (props.interactionHint ?? "6 × 3  /  6 × 3")}
          </div>
        </section>
        <aside className="hud-context">
          <div className="hud-mini-items">
            {p.inventory.slice(0, 4).map((id, i) => (
              <button
                key={i}
                title={ITEM_MAP[id].name}
                onClick={() => open("items")}
              >
                {ITEM_MAP[id].glyph}
              </button>
            ))}
          </div>
          {props.context}
        </aside>
      </div>
      <section className="bench-bar" aria-label={l.bench}>
        <div className="hud-bench-label">
          <b>
            {l.bench} {p.units.filter((u) => u.slot >= 36).length}/8
          </b>
          <span>{l.auto}</span>
        </div>
        {props.bench}
      </section>
      <nav className="game-action-bar" aria-label="Game actions">
        {(
          [
            ["players", "◎"],
            ["context", "◇"],
            ["shop", "▦"],
            ["items", "✦"],
            ["bonuses", "◆"],
            ["stats", "▥"],
            ["summary", "≡"],
            ["guide", "?"],
            ["settings", "⚙"],
          ] as const
        ).map(([key, icon]) => (
          <button
            key={key}
            className={"action-" + key}
            onClick={() => open(key)}
            disabled={
              !!item ||
              !!augment ||
              !connected ||
              (key === "shop" && (r.phase !== "Preparing" || p.hp <= 0))
            }
            aria-label={l[key]}
            title={l[key]}
          >
            <span aria-hidden="true">{icon}</span>
            {l[key]}
            {(
              key === "items"
                ? p.inventory.length
                : key === "bonuses"
                  ? p.augments?.length
                  : key === "shop"
                    ? p.shop.filter(Boolean).length
                    : key === "summary" &&
                        p.latestSummary &&
                        p.latestSummary.round > seenSummary
                      ? 1
                      : 0
            ) ? (
              <small className="hud-badge">
                {key === "items"
                  ? p.inventory.length
                  : key === "bonuses"
                    ? p.augments?.length
                    : key === "shop"
                      ? p.shop.filter(Boolean).length
                      : l.new}
              </small>
            ) : null}
          </button>
        ))}
      </nav>
      {confirmation && (
        <div className="hud-confirmation" role="status">
          {confirmation}
        </div>
      )}
      {active && (
        <Overlay
          key={active}
          title={title}
          onClose={close}
          mandatory={["connection", "finished", "item", "augment"].includes(
            active,
          )}
          variant={variant}
        >
          {content}
        </Overlay>
      )}
    </main>
  );
}
