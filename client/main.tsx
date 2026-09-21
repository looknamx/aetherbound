import { FieldGuide } from "./hud/FieldGuide";
import { TeamStatistics } from "./hud/TeamStatistics";
import { GameShell } from "./hud/GameShell";
import { HUD } from "./hud/labels";
import {
  PracticeEntry,
  AugmentList,
  SynergyHint,
} from "./strategy/StrategyPanels";
import { LABELS, type Locale } from "./strategy/labels";
import type { Difficulty } from "../shared/strategyTypes";
import { augmentValue } from "../shared/strategyConfig";
import { shopOdds } from "../shared/pool";
import { isDeploymentSlot, PLACEMENT_MESSAGE } from "../shared/deploymentZone";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Board } from "./Board";
import { UnitCard } from "./cards/UnitCard";
import { CardDragPreview, setCardDragImage } from "./cards/CardDragPreview";
import { useAutoDeployFeedback } from "./cards/useAutoDeployFeedback";
import { socket, request, sendAction } from "./network";
import { tone } from "./audio";
import {
  COLORS,
  ITEMS,
  ITEM_MAP,
  TRAITS,
  UNIT_MAP,
  UNITS,
} from "../shared/content";
import type { Action, Snapshot, Unit, Fighter } from "../shared/types";
import "./style.css";
import "./cards/cards.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "./hud/hud.css";
const wordmark = (
  <span className="wordmark">
    <span className="brand-icon">◈</span> AETHERBOUND
  </span>
);
function App() {
  const [locale, setLocale] = useState<Locale>("th");
  const [state, setState] = useState<Snapshot>();
  const latestState = useRef<Snapshot | undefined>(undefined);
  const [connected, setConnected] = useState(false),
    [name, setName] = useState(localStorage.getItem("aether-name") || ""),
    [key, setKey] = useState(
      new URLSearchParams(location.search).get("room") || "",
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<string>(),
    [selectedItem, setSelectedItem] = useState<number>(),
    [sound, setSound] = useState(
      localStorage.getItem("aether-sound") === "true",
    ),
    [reduced, setReduced] = useState(
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [speed, setSpeed] = useState(1),
    [settings, setSettings] = useState(false),
    [codex, setCodex] = useState(false),
    [now, setNow] = useState(Date.now()),
    [pending, setPending] = useState(false),
    [devValue, setDevValue] = useState("cinder");
  const [cardDetail, setCardDetail] = useState<
    Pick<Unit, "defId" | "star" | "items"> & { fighter?: Fighter }
  >();
  const [dragView, setDragView] = useState<{
    id: string;
    x: number;
    y: number;
  }>();
  const flights = useAutoDeployFeedback(state, reduced);
  useEffect(() => {
    const onState = (s: Snapshot) => {
      if (s.version !== 2) {
        setError("Please reload to update the game client.");
        return;
      }
      latestState.current = s;
      setState(s);
    };
    const connect = () => {
      setConnected(true);
      setError("");
      const token = sessionStorage.getItem("aether-token");
      if (token)
        void request("resume", token).then((r) => {
          if (!r.ok) {
            sessionStorage.removeItem("aether-token");
            setState(undefined);
            setError(r.error!);
          }
        });
    };
    socket.on("state", onState);
    socket.on("connect", connect);
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () =>
      setError("Unable to reach the game server. Reconnecting…"),
    );
    socket.on("expired", () => {
      sessionStorage.removeItem("aether-token");
      setState(undefined);
      setError("This room has expired.");
    });
    socket.on("replaced", () => {
      sessionStorage.removeItem("aether-token");
      setState(undefined);
      setError("This session was opened in another window.");
    });
    socket.connect();
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(interval);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  const r = state?.room,
    p = r?.players.find((p) => p.id === state?.you),
    unit = p?.units.find((u) => u.id === selected),
    def = unit ? UNIT_MAP[unit.defId] : undefined;
  // Server clock offset is captured with each snapshot, not recalculated by the countdown.
  const [clockOffset, setClockOffset] = useState(0);
  useEffect(() => {
    if (state) setClockOffset(state.serverTime - Date.now());
  }, [state]);
  const act = async (action: Action) => {
    if (pending) return;
    setPending(true);
    setError("");
    const oldStars = new Map(p?.units.map((u) => [u.id, u.star]) ?? []);
    const reply = await sendAction(action);
    setPending(false);
    if (!reply.ok) setError(reply.error!);
    else {
      tone(sound);
      if (action.type === "buy") {
        const current = latestState.current;
        const ascended = current?.room.players
          .find((x) => x.id === current.you)
          ?.units.find((u) => u.star > (oldStars.get(u.id) ?? 1));
        setNotice(
          ascended
            ? `Ascension! ${UNIT_MAP[ascended.defId].name} ${"★".repeat(ascended.star)}`
            : "Recruit enlisted",
        );
        if (ascended) tone(sound, "cast");
      }
      if (action.type === "equip") setNotice("Relic equipped");
      if (action.type === "sell") {
        setSelected(undefined);
        setNotice("Recruit sold · relics returned");
      }
    }
    return reply;
  };
  const practice = async (difficulty: Difficulty) => {
    setPending(true);
    setError("");
    const reply = await request("practice", { name, difficulty });
    setPending(false);
    if (reply.ok) {
      sessionStorage.setItem("aether-token", reply.token!);
      localStorage.setItem("aether-name", name);
      history.replaceState({}, "", "/");
    } else setError(reply.error!);
  };
  const enter = async (join: boolean) => {
    setPending(true);
    setError("");
    const reply = await request("enter", {
      name,
      ...(join ? { key: key.toUpperCase().trim() } : {}),
    });
    setPending(false);
    if (reply.ok) {
      sessionStorage.setItem("aether-token", reply.token!);
      localStorage.setItem("aether-name", name);
      history.replaceState({}, "", `?room=${reply.key}`);
      tone(sound);
    } else setError(reply.error!);
  };
  const drop = (slot: number, id?: string, item?: number) => {
    if (!connected || pending || r?.phase !== "Preparing" || !p || p.hp <= 0)
      return;
    if (slot < 36 && !isDeploymentSlot(slot)) {
      setError(PLACEMENT_MESSAGE);
      return;
    }
    const target = p?.units.find((u) => u.slot === slot);
    if (item !== undefined) {
      if (target)
        void act({ type: "equip", unitId: target.id, itemIndex: item });
      else setError("Drop a relic onto a recruit.");
    } else if (id || selected) {
      void act({ type: "move", unitId: id || selected!, slot });
      setSelected(undefined);
    }
  };
  const select = (id: string) => {
    if (
      selectedItem !== undefined &&
      r?.phase === "Preparing" &&
      connected &&
      !pending
    ) {
      void act({ type: "equip", unitId: id, itemIndex: selectedItem });
      setSelectedItem(undefined);
    } else setSelected(selected === id ? undefined : id);
  };
  const disabled =
    !connected || pending || r?.phase !== "Preparing" || !p || p.hp <= 0;
  const battle =
    r?.phase === "Battling"
      ? (r.battles.find((b) => b.a === p?.id || b.b === p?.id) ?? r.battles[0])
      : undefined;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?room=${r?.key}`);
      setNotice("Invite link copied");
    } catch {
      setNotice(`Invite: ${location.origin}/?room=${r?.key}`);
    }
  };
  const touchDrag = useRef<
    { x: number; y: number; unit?: string; item?: number } | undefined
  >(undefined);
  const suppressClick = useRef(false);
  return (
    <div
      className={
        (reduced ? "app reduced" : "app") +
        (r && r.phase !== "Lobby" ? " in-game" : "")
      }
      onPointerDownCapture={(e) => {
        if (e.pointerType === "mouse" || disabled) return;
        const target = (e.target as Element).closest<HTMLElement>(
          "[data-unit],[data-item]",
        );
        if (!target) return;
        touchDrag.current = {
          x: e.clientX,
          y: e.clientY,
          unit: target.dataset.unit,
          item:
            target.dataset.item === undefined
              ? undefined
              : Number(target.dataset.item),
        };
      }}
      onPointerUpCapture={(e) => {
        setDragView(undefined);
        const drag = touchDrag.current;
        touchDrag.current = undefined;
        if (!drag || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10)
          return;
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-slot]");
        if (target) drop(Number(target.dataset.slot), drag.unit, drag.item);
        suppressClick.current = true;
      }}
      onPointerCancel={() => {
        touchDrag.current = undefined;
        setDragView(undefined);
      }}
      onPointerMoveCapture={(e) => {
        const drag = touchDrag.current;
        if (
          drag?.unit &&
          Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10
        )
          setDragView({ id: drag.unit, x: e.clientX, y: e.clientY });
      }}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.stopPropagation();
          e.preventDefault();
          suppressClick.current = false;
        }
      }}
    >
      {p && <CardDragPreview units={p.units} />}
      {dragView && p?.units.find((u) => u.id === dragView.id) && (
        <div
          className="touch-card-preview"
          style={{ left: dragView.x + 12, top: dragView.y + 12 }}
        >
          <UnitCard
            unit={p.units.find((u) => u.id === dragView.id)!}
            variant="drag"
          />
        </div>
      )}
      {flights.map((f) => (
        <div
          key={f.id}
          className="auto-flight"
          aria-hidden="true"
          style={
            {
              left: f.x,
              top: f.y,
              "--dx": `${f.dx}px`,
              "--dy": `${f.dy}px`,
            } as React.CSSProperties
          }
        >
          <UnitCard unit={f.unit} variant="drag" />
        </div>
      ))}
      {(!r || r.phase === "Lobby") && (
        <header>
          {wordmark}
          <div className="header-right">
            <span className={`connection ${connected ? "online" : ""}`}>
              ● {connected ? "Connected" : "Reconnecting"}
            </span>
            <button className="quiet" onClick={() => setCodex(true)}>
              Field guide
            </button>
            <button
              className="icon-button"
              aria-label="Settings"
              onClick={() => setSettings(!settings)}
            >
              ⚙
            </button>
          </div>
        </header>
      )}
      {error && (
        <div className="toast error" role="alert" onClick={() => setError("")}>
          {error} <span>×</span>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {!r || !p ? (
        <main className="landing">
          <div className="hero-art" aria-hidden="true">
            <div className="orbit one" />
            <div className="orbit two" />
            <div className="floating-isle">
              <div className="isle-grid" />
              <div className="spire s1" />
              <div className="spire s2" />
              <div className="spire s3" />
              <div className="isle-core">◈</div>
            </div>
            <div className="tiny-star star1">✦</div>
            <div className="tiny-star star2">✧</div>
            <div className="art-caption">
              THE SHATTERED ISLES <span>EST. AGE OF ECHOES</span>
            </div>
          </div>
          <section className="hero-copy">
            <div className="eyebrow">A TACTICAL AUTO BATTLER · 2–4 PLAYERS</div>
            <h1>
              Small armies.
              <br />
              <em>Extraordinary</em>
              <br />
              rivalries.
            </h1>
            <p>
              Gather an unlikely alliance. Shape your formation.
              <br />
              Outlast your friends in the skies of Aether.
            </p>
            <div className="entry-panel">
              <label htmlFor="name">YOUR CALLSIGN</label>
              <input
                id="name"
                maxLength={24}
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="primary"
                disabled={!connected || pending || !name.trim()}
                onClick={() => void enter(false)}
              >
                Create a private room <span>↗</span>
              </button>
              <PracticeEntry
                locale={locale}
                disabled={!connected || pending || !name.trim()}
                onStart={(difficulty) => void practice(difficulty)}
              />
              <div className="separator">
                <span>OR JOIN YOUR FRIENDS</span>
              </div>
              <div className="join-row">
                <input
                  aria-label="Room key"
                  maxLength={6}
                  placeholder="ROOM KEY"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                />
                <button
                  disabled={
                    !connected ||
                    pending ||
                    !name.trim() ||
                    key.trim().length !== 6
                  }
                  onClick={() => void enter(true)}
                >
                  Join room →
                </button>
              </div>
            </div>
            <div className="hero-foot">
              NO ACCOUNTS. JUST ALLIES & ADVERSARIES.
            </div>
          </section>
          <footer>
            18 RECRUITS <span>·</span> 10 TRAITS <span>·</span> ONE SURVIVOR{" "}
            <div>Original world. Endless formations.</div>
          </footer>
        </main>
      ) : r.phase === "Lobby" ? (
        <main className="lobby">
          <div className="eyebrow">PRIVATE EXPEDITION</div>
          <h1>The gathering</h1>
          <p>
            Your island awaits. Invite your rivals, then ready your banners.
          </p>
          <div className="invite">
            <div>
              <label>ROOM KEY</label>
              <strong data-testid="room-key">{r.key}</strong>
            </div>
            <button onClick={() => void copy()}>Copy invite link ↗</button>
          </div>
          <div className="lobby-players">
            {Array.from({ length: 4 }, (_, i) => {
              const member = r.players[i];
              return (
                <div
                  className={`lobby-player ${member?.ready ? "is-ready" : ""}`}
                  key={i}
                >
                  <div className="player-emblem">
                    {member ? ["◈", "✧", "⬡", "△"][i] : "+"}
                  </div>
                  <h3>{member?.name || "Open seat"}</h3>
                  <p>
                    {member
                      ? member.id === r.hostId
                        ? "ROOM HOST"
                        : "CHALLENGER"
                      : "Invite a friend"}
                  </p>
                  <span>
                    {member
                      ? member.connected
                        ? member.ready
                          ? "● Ready"
                          : "Waiting for ready"
                        : "Disconnected"
                      : "2–4 players"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="lobby-actions">
            <button
              className={p.ready ? "" : "primary"}
              onClick={() => void act({ type: "ready", ready: !p.ready })}
              disabled={pending || !connected}
            >
              {p.ready ? "Cancel ready" : "Ready up"}
            </button>
            {r.hostId === p.id && (
              <button
                className="primary"
                disabled={
                  pending ||
                  r.players.length < 2 ||
                  !r.players.every((p) => p.ready && p.connected)
                }
                onClick={() => void act({ type: "start" })}
              >
                Begin expedition →
              </button>
            )}
          </div>
          <p className="hint">
            Everyone must be ready. Keep this tab to reconnect to your seat.
          </p>
        </main>
      ) : (
        <GameShell
          state={state}
          locale={locale}
          connected={connected}
          pending={pending}
          interactionHint={
            selectedItem !== undefined
              ? locale === "th"
                ? "เลือกตัวละครเพื่อสวมไอเทม"
                : "Select a recruit to equip the item"
              : selected
                ? locale === "th"
                  ? "เลือกช่องว่างเพื่อย้ายตัวละคร"
                  : "Select a tile to move the recruit"
                : undefined
          }
          remaining={Math.max(
            0,
            Math.ceil((r.deadline - now - clockOffset) / 1000),
          )}
          onAction={act}
          onHome={() => {
            sessionStorage.removeItem("aether-token");
            location.href = "/";
          }}
          onAgain={() => {
            if (pending) return;
            setPending(true);
            sessionStorage.removeItem("aether-token");
            setSelected(undefined);
            setSelectedItem(undefined);
            setCardDetail(undefined);
            socket.disconnect();
            socket.once("connect", () => {
              if (r.mode === "practice")
                void practice(
                  r.players.find((x) => x.bot)?.bot?.difficulty ?? "normal",
                );
              else void enter(false);
            });
            socket.connect();
          }}
          clearDetail={() => setCardDetail(undefined)}
          detail={
            cardDetail ? (
              <UnitCard
                unit={cardDetail}
                fighter={cardDetail.fighter}
                variant="detail"
              />
            ) : undefined
          }
          board={
            <Board
              compact
              onInspect={(u, fighter) => setCardDetail({ ...u, fighter })}
              units={p.units}
              battle={battle}
              deadline={r.deadline}
              serverOffset={clockOffset}
              selected={selected}
              onSelect={select}
              onSlot={(slot) => {
                const target = p.units.find((u) => u.slot === slot);
                if (selectedItem !== undefined && target) select(target.id);
                else drop(slot);
              }}
              onDrop={drop}
              disabled={disabled}
              reduced={reduced}
              speed={speed}
              sound={sound}
              playerId={p.id}
              blockedSlots={p.blockedSlots}
              dragging={!!dragView}
              locale={locale}
              eventCursor={state.eventCursor}
            />
          }
          bench={
            <div className="bench">
              {Array.from({ length: 8 }, (_, i) => {
                const u = p.units.find((u) => u.slot === i + 36);
                return (
                  <button
                    className={`bench-slot ${u && selected === u.id ? "chosen" : ""} ${u && p.units.filter((x) => x.defId === u.defId && x.star === u.star).length >= 2 ? "merge-ready" : ""}`}
                    data-slot={i + 36}
                    data-unit={u?.id}
                    data-testid={`bench-${i}`}
                    key={i}
                    disabled={disabled && !u}
                    draggable={!!u && !disabled}
                    onDragStart={(e) => {
                      if (u) {
                        e.dataTransfer.setData("unit", u.id);
                        setCardDragImage(e, u.id);
                        setSelected(u.id);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (disabled) return;
                      const item = e.dataTransfer.getData("item");
                      drop(
                        i + 36,
                        e.dataTransfer.getData("unit") || undefined,
                        item ? Number(item) : undefined,
                      );
                    }}
                    onClick={() => (u ? select(u.id) : drop(i + 36))}
                    aria-label={
                      u
                        ? `Reserve ${UNIT_MAP[u.defId].name}`
                        : `Empty reserve ${i + 1}`
                    }
                  >
                    {u ? (
                      <UnitCard
                        unit={u}
                        variant="bench"
                        selected={selected === u.id}
                        recommended={state.autoDeployPreview?.includes(u.id)}
                        disabled={disabled}
                      />
                    ) : (
                      <span className="slot-number">{i + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
          }
          shop={
            <section className="shop">
              <div className="shop-heading">
                <div>
                  <span className="section-label">THE WAYFARER’S MARKET</span>
                  <small>Recruit. Combine. Ascend.</small>
                </div>
                <div
                  className="shop-odds"
                  title="Rarity odds at your current level"
                >
                  {shopOdds(p).map((n, i) => (
                    <span key={i} style={{ color: COLORS[i] }}>
                      {Math.round(n)}%
                    </span>
                  ))}
                </div>
                <div className="shop-actions">
                  <button
                    disabled={disabled}
                    className={p.locked ? "locked" : ""}
                    onClick={() => void act({ type: "lock" })}
                  >
                    {p.locked ? "◆ Locked" : "◇ Lock shop"}
                  </button>
                  <button
                    disabled={
                      disabled ||
                      p.gold <
                        Math.max(1, 2 - augmentValue(p.augments, "reroll"))
                    }
                    onClick={() => void act({ type: "reroll" })}
                  >
                    ↻ Refresh{" "}
                    <span>
                      {Math.max(1, 2 - augmentValue(p.augments, "reroll"))} ◉
                    </span>
                  </button>
                </div>
              </div>
              <p className="hint">{LABELS[locale].pool}</p>
              <div className="shop-cards">
                {p.shop.map((id, i) =>
                  id ? (
                    <div key={i} className="shop-slot">
                      <button
                        key={i}
                        data-testid={`shop-${i}`}
                        className="recruit-card"
                        style={
                          {
                            "--rarity": COLORS[UNIT_MAP[id].cost - 1],
                          } as React.CSSProperties
                        }
                        disabled={disabled || p.gold < UNIT_MAP[id].cost}
                        onClick={() => void act({ type: "buy", index: i })}
                        title={`${UNIT_MAP[id].skill.name}: ${UNIT_MAP[id].skill.description}`}
                        aria-label={`Buy ${UNIT_MAP[id].name}`}
                      >
                        <UnitCard
                          unit={{ defId: id, star: 1, items: [] }}
                          variant="shop"
                          affordable={p.gold >= UNIT_MAP[id].cost}
                          disabled={disabled}
                        />
                      </button>
                      <button
                        className="inspect-shop"
                        onClick={() =>
                          setCardDetail({ defId: id, star: 1, items: [] })
                        }
                        aria-label={`Inspect ${UNIT_MAP[id].name}`}
                      >
                        Details & ability ↗
                      </button>
                      <details>
                        <summary>{HUD[locale].traits}</summary>
                        <SynergyHint player={p} defId={id} locale={locale} />
                      </details>
                    </div>
                  ) : (
                    <div key={i} className="sold-card">
                      ✧<span>RECRUITED</span>
                    </div>
                  ),
                )}
              </div>
            </section>
          }
          items={
            <>
              {" "}
              <div className="inventory">
                {p.inventory.map((id, i) => (
                  <button
                    key={`${id}-${i}`}
                    className={selectedItem === i ? "chosen" : ""}
                    title={`${ITEM_MAP[id].name}: ${ITEM_MAP[id].description}`}
                    aria-label={`Equip ${ITEM_MAP[id].name}`}
                    data-item={i}
                    disabled={disabled}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("item", String(i))
                    }
                    onClick={() => {
                      if (selected)
                        void act({
                          type: "equip",
                          unitId: selected,
                          itemIndex: i,
                        });
                      else setSelectedItem(selectedItem === i ? undefined : i);
                    }}
                  >
                    {ITEM_MAP[id].glyph}
                  </button>
                ))}
                {!p.inventory.length && (
                  <span className="hint">Relics may arrive after battle.</span>
                )}
              </div>
              <p className="hint">
                Drag onto a recruit, or select relic then recruit.
              </p>
            </>
          }
          context={
            <>
              <button
                disabled={disabled || p.gold < 4 || p.level >= 8}
                onClick={() => void act({ type: "xp" })}
              >
                {HUD[locale].xp}
              </button>{" "}
              <div className="unit-info">
                {def && unit ? (
                  <>
                    <UnitCard unit={unit} variant="detail" />
                    <TeamStatistics
                      locale={locale}
                      snapshot={
                        p.latestBattleStats
                          ? {
                              ...p.latestBattleStats,
                              units: p.latestBattleStats.units.filter(
                                (row) => row.unitId === unit.id,
                              ),
                            }
                          : undefined
                      }
                    />
                    <div className="equipped">
                      {unit.items.map((id, i) => (
                        <button
                          key={i}
                          disabled={disabled}
                          title={`${ITEM_MAP[id].description} Click to unequip.`}
                          onClick={() =>
                            void act({
                              type: "unequip",
                              unitId: unit.id,
                              itemIndex: i,
                            })
                          }
                        >
                          {ITEM_MAP[id].glyph} ×
                        </button>
                      ))}
                    </div>
                    <button
                      className="sell-button"
                      disabled={disabled}
                      onClick={() =>
                        void act({ type: "sell", unitId: unit.id })
                      }
                    >
                      Sell recruit{" "}
                      <span>+{def.cost * 3 ** (unit.star - 1)} ◉</span>
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setSelected(undefined)}
                    >
                      Clear selection
                    </button>
                  </>
                ) : (
                  <>
                    <div className="empty-sigil">✧</div>
                    <h3>{HUD[locale].context}</h3>
                    <p className="hint">{HUD[locale].help}</p>
                  </>
                )}
              </div>
              <AugmentList ids={p.augments ?? []} locale={locale} />
            </>
          }
          settings={
            <>
              {state.devTools && r.hostId === p.id && (
                <details className="hud-developer">
                  <summary>Development controls · loopback only</summary>
                  <input
                    aria-label="Developer value"
                    value={devValue}
                    onChange={(e) => setDevValue(e.target.value)}
                  />
                  {(
                    [
                      "gold",
                      "level",
                      "seed",
                      "shop",
                      "unit",
                      "item",
                      "advance",
                      "speed",
                    ] as const
                  ).map((command) => (
                    <button
                      key={command}
                      disabled={pending}
                      onClick={() =>
                        void act({ type: "dev", command, value: devValue })
                      }
                    >
                      {command}
                    </button>
                  ))}
                </details>
              )}
              <label>
                {HUD[locale].sound}
                <input
                  type="checkbox"
                  checked={sound}
                  onChange={(e) => {
                    setSound(e.target.checked);
                    localStorage.setItem(
                      "aether-sound",
                      String(e.target.checked),
                    );
                  }}
                />
              </label>
              <label>
                {HUD[locale].motion}
                <input
                  type="checkbox"
                  checked={reduced}
                  onChange={(e) => setReduced(e.target.checked)}
                />
              </label>
              <label>
                {HUD[locale].speed}
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                </select>
              </label>
              <label>
                {HUD[locale].language}
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                >
                  <option value="th">Thai</option>
                  <option value="en">English</option>
                </select>
              </label>
            </>
          }
          guide={<FieldGuide locale={locale} onInspect={setCardDetail} />}
        />
      )}
      {settings && (!r || r.phase === "Lobby") && (
        <div className="settings">
          <h3>Expedition settings</h3>
          <label>
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => {
                setSound(e.target.checked);
                localStorage.setItem("aether-sound", String(e.target.checked));
                tone(e.target.checked);
              }}
            />{" "}
            Sound effects
          </label>
          <label>
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => setReduced(e.target.checked)}
            />{" "}
            Reduce motion & effects
          </label>
          <label>
            Replay speed{" "}
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </label>
          <p className="hint">
            Playback speed does not change the server timer.
          </p>
          <button onClick={() => setSettings(false)}>Close</button>
        </div>
      )}
      {codex && (!r || r.phase === "Lobby") && (
        <div className="modal-backdrop">
          <section className="modal codex">
            <button
              className="close"
              onClick={() => setCodex(false)}
              aria-label="Close field guide"
            >
              ×
            </button>
            <div className="eyebrow">AETHERBOUND FIELD GUIDE</div>
            <h2>Every formation tells a story.</h2>
            <p>
              Buy recruits, deploy up to your level, then watch the server
              resolve combat. Combine three identical stars to ascend, up to
              ★★★. Survive with the last banner standing.
            </p>
            <p>
              30s preparation → automatic battle → results. Earn 5 base gold, up
              to 5 interest (1 per 10 saved), streak bonuses and 1 victory gold.
              Buy 4 XP for 4 gold. Relics can be moved freely during
              preparation. Field rows compress into your half of the combat
              arena, preserving front/back order.
            </p>
            <h3>The recruits</h3>
            <div className="codex-units">
              {UNITS.map((d) => (
                <article key={d.id} className="card-catalog-entry">
                  <button
                    className="catalog-card"
                    onClick={() =>
                      setCardDetail({ defId: d.id, star: 1, items: [] })
                    }
                    aria-label={`Inspect ${d.name}`}
                  >
                    <UnitCard
                      unit={{ defId: d.id, star: 1, items: [] }}
                      variant="preview"
                    />
                  </button>
                </article>
              ))}
            </div>
            <h3>Traits · 2 / 4 unique recruits</h3>
            <div className="codex-traits">
              {TRAITS.map((t) => (
                <p key={t.id}>
                  <strong>{t.id}</strong> {t.description}
                </p>
              ))}
            </div>
            <h3>The relics</h3>
            <div className="codex-traits">
              {ITEMS.map((i) => (
                <p key={i.id}>
                  <strong>
                    {i.glyph} {i.name}
                  </strong>{" "}
                  {i.description}
                </p>
              ))}
            </div>
          </section>
        </div>
      )}
      {cardDetail && (!r || r.phase === "Lobby") && (
        <div className="modal-backdrop card-detail-backdrop">
          <section
            className="modal card-inspection"
            role="dialog"
            aria-label="Card details"
          >
            <button
              className="close"
              aria-label="Close card details"
              onClick={() => setCardDetail(undefined)}
            >
              ×
            </button>
            <UnitCard
              unit={cardDetail}
              fighter={cardDetail.fighter}
              variant="detail"
            />
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
