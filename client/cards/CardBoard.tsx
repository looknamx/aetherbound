import {
  canonicalToRelative,
  isDeploymentSlot,
} from "../../shared/deploymentZone";
import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { BOARD, RULES, UNIT_MAP } from "../../shared/content";
import type { Battle, CombatFrame, Unit } from "../../shared/types";
import { tone } from "../audio";
import { UnitCard } from "./UnitCard";
import { setCardDragImage } from "./CardDragPreview";
import { EventCursor, eventLabel } from "../../shared/combatEvents";
import { LABELS, type Locale } from "../strategy/labels";
export const CELL = 76,
  OFFSET = 32;
interface Props {
  units: Unit[];
  battle?: Battle;
  deadline: number;
  serverOffset: number;
  selected?: string;
  onSlot: (slot: number) => void;
  onSelect: (id: string) => void;
  onDrop: (slot: number, id?: string, item?: number) => void;
  disabled: boolean;
  reduced: boolean;
  speed: number;
  sound: boolean;
  playerId?: string;
  blockedSlots?: number[];
  dragging?: boolean;
  locale?: Locale;
  eventCursor?: number;
}
export function playbackFrame(
  battle: Battle,
  now: number,
  deadline: number,
  speed: number,
) {
  const elapsed =
    battle.startedAt !== undefined
      ? (now - battle.startedAt) * (battle.playbackRate ?? 1)
      : battle.duration - (deadline - now);
  return battle.frames[
    Math.min(
      battle.frames.length - 1,
      Math.max(0, Math.floor((elapsed / RULES.tickMs) * speed)),
    )
  ];
}
export function CardBoard(props: Props) {
  const cursor = useRef(new EventCursor()),
    playbackBattle = useRef("");
  const [eventLog, setEventLog] = useState<string[]>([]);
  const mount = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    liveFrame = useRef<CombatFrame | undefined>(undefined);
  latest.current = props;
  const [frame, setFrame] = useState<CombatFrame>(),
    [inspected, setInspected] = useState<string>();
  useEffect(() => {
    if (!props.battle) {
      setFrame(undefined);
      liveFrame.current = undefined;
      return;
    }
    if (playbackBattle.current !== props.battle.id) {
      playbackBattle.current = props.battle.id;
      cursor.current.reset(props.battle.id, props.eventCursor ?? -1);
      liveFrame.current = undefined;
      setEventLog([]);
    }
    const update = () => {
      const p = latest.current;
      if (!p.battle) return;
      const current = playbackFrame(
        p.battle,
        Date.now() + p.serverOffset,
        p.deadline,
        p.speed,
      );
      if (liveFrame.current?.tick === current.tick) return;
      const fresh = cursor.current.consume(
        p.battle.id,
        p.battle.frames
          .filter((f) => f.tick <= current.tick)
          .flatMap((f) => f.events),
      );
      const labels = fresh
        .map((e) => eventLabel(e, current, p.locale ?? "th"))
        .filter((s): s is string => !!s);
      if (labels.length) setEventLog((old) => [...old, ...labels].slice(-12));
      const rendered = {
        ...current,
        events: fresh.filter((e) => e.tick === current.tick),
      };
      liveFrame.current = rendered;
      setFrame(rendered);
    };
    update();
    const timer = setInterval(update, 50);
    return () => clearInterval(timer);
  }, [props.battle]);
  // Phaser preserves terrain and combat effects; cards share an accessible DOM component.
  useEffect(() => {
    let graphics: Phaser.GameObjects.Graphics,
      lastTick = -1,
      lastBattle = "";
    class Arena extends Phaser.Scene {
      create() {
        graphics = this.add.graphics();
      }
      update() {
        if (!graphics) return;
        const p = latest.current,
          g = graphics;
        g.clear();
        g.fillStyle(0x101f26);
        g.fillRoundedRect(8, 8, 504, 504, 14);
        g.lineStyle(1, 0x799b8d, 0.25);
        g.strokeRoundedRect(9, 9, 502, 502, 14);
        for (let y = 0; y < BOARD.size; y++)
          for (let x = 0; x < BOARD.size; x++) {
            const px = OFFSET + x * CELL,
              py = OFFSET + y * CELL,
              locked =
                p.blockedSlots?.includes(y * BOARD.size + x) ||
                (!p.battle && !isDeploymentSlot(y * BOARD.size + x));
            g.fillStyle(locked ? 0x111d22 : (x + y) % 2 ? 0x1d343a : 0x243d41);
            g.fillRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 4);
            g.lineStyle(1, 0x7ca999, 0.12);
            g.strokeRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 4);
          }
        g.lineStyle(1, 0xe8c684, 0.4);
        g.lineBetween(OFFSET, 260, 488, 260);
        const current = liveFrame.current;
        if (!p.battle || !current) return;
        if (lastBattle !== p.battle.id) {
          lastBattle = p.battle.id;
          lastTick = -1;
        }
        const newTick = lastTick !== current.tick;
        lastTick = current.tick;
        for (const event of current.events) {
          const source = current.units.find((u) => u.id === event.source),
            target = current.units.find((u) => u.id === event.target);
          if (!source || !target || !["attack", "cast"].includes(event.type))
            continue;
          if (newTick) tone(p.sound, event.type);
          if (p.reduced) continue;
          g.lineStyle(
            event.type === "cast" ? 5 : 2,
            event.type === "cast" ? 0xc4a4fa : 0xecd99d,
            0.9,
          );
          const side = p.battle.a === p.playerId ? 0 : 1;
          const from = canonicalToRelative(source, side),
            to = canonicalToRelative(target, side);
          g.lineBetween(
            OFFSET + (from.x + 0.5) * CELL,
            OFFSET + (from.y + 0.5) * CELL,
            OFFSET + (to.x + 0.5) * CELL,
            OFFSET + (to.y + 0.5) * CELL,
          );
        }
      }
    }
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: mount.current!,
      width: 520,
      height: 520,
      transparent: true,
      scene: Arena,
      banner: false,
      audio: { noAudio: true },
      fps: { target: 30 },
      render: { antialias: true },
    });
    return () => game.destroy(true);
  }, []);
  const currentFighter = frame?.units.find((u) => u.id === inspected),
    ownSide = props.battle?.a === props.playerId ? 0 : 1;
  return (
    <>
      {!props.battle && (
        <div className="zone-legend">
          <span>ด้านบน · พื้นที่ฝ่ายตรงข้าม</span>
          <span>ด้านล่าง · พื้นที่วางของคุณ 6×3</span>
        </div>
      )}
      <div className="arena" ref={mount}>
        <div
          className="board-input"
          role="grid"
          aria-label="6 by 6 battlefield"
        >
          {Array.from({ length: BOARD.cells }, (_, slot) => {
            const unit = props.units.find((u) => u.slot === slot),
              blocked = props.blockedSlots?.includes(slot),
              enemyZone = !isDeploymentSlot(slot);
            return (
              <button
                key={slot}
                role="gridcell"
                className={`tile ${enemyZone ? "enemy-zone" : "own-zone"} ${unit && unit.id === props.selected ? "selected" : ""} ${(props.selected || props.dragging) && !props.disabled && !enemyZone && !blocked ? "available" : ""}`}
                data-slot={slot}
                data-unit={!props.battle ? unit?.id : undefined}
                aria-label={`Tile ${slot + 1}${unit ? `: ${UNIT_MAP[unit.defId].name}` : ""}${blocked ? " (locked)" : ""}`}
                aria-disabled={enemyZone || blocked || props.disabled}
                disabled={
                  !!props.battle || blocked || (props.disabled && !unit)
                }
                onClick={() => {
                  if (enemyZone) {
                    props.onSlot(slot);
                    return;
                  }
                  if (
                    unit &&
                    (props.disabled ||
                      !props.selected ||
                      props.selected === unit.id)
                  )
                    props.onSelect(unit.id);
                  else props.onSlot(slot);
                }}
                draggable={!!unit && !props.disabled}
                onDragStart={(e) => {
                  if (unit) {
                    props.onSelect(unit.id);
                    e.dataTransfer.setData("unit", unit.id);
                    setCardDragImage(e, unit.id);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect =
                    enemyZone || blocked || props.disabled ? "none" : "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (props.disabled) return;
                  const item = e.dataTransfer.getData("item");
                  props.onDrop(
                    slot,
                    e.dataTransfer.getData("unit") || undefined,
                    item ? Number(item) : undefined,
                  );
                }}
              >
                {!props.battle && unit && (
                  <UnitCard
                    unit={unit}
                    variant="board"
                    selected={unit.id === props.selected}
                  />
                )}{" "}
                {blocked && !unit && <span aria-hidden="true">×</span>}
              </button>
            );
          })}
        </div>
        {props.battle && frame && (
          <div className="combat-layer" aria-label="Battle cards">
            {frame.units.map((f) => {
              const position = canonicalToRelative(f, ownSide);
              const hurt = frame.events.some(
                  (e) =>
                    e.type === "damage" &&
                    (e.value ?? 0) > 0 &&
                    e.target === f.id,
                ),
                cast = frame.events.some(
                  (e) => e.type === "cast" && e.source === f.id,
                );
              const broken = frame.events.some(
                (e) => e.type === "shieldBreak" && e.source === f.id,
              );
              const callout = frame.events.find(
                (e) =>
                  (e.type === "cast" ||
                    e.type === "shieldBreak" ||
                    e.type === "death") &&
                  e.source === f.id,
              );
              return (
                <button
                  key={f.id}
                  className={`combat-card ${hurt ? "is-hit" : ""} ${cast ? "is-casting" : ""} ${f.hp <= 0 ? "is-dead" : ""} ${broken ? "shield-broken" : ""}`}
                  style={{
                    left: `${(position.x / BOARD.size) * 100}%`,
                    top: `${(position.y / BOARD.size) * 100}%`,
                  }}
                  aria-label={`Inspect ${f.side === ownSide ? "ally" : "enemy"} ${UNIT_MAP[f.defId].name}`}
                  onClick={() => setInspected(f.id)}
                >
                  <UnitCard
                    unit={{
                      defId: f.defId,
                      star: f.star,
                      items: f.items ?? [],
                    }}
                    fighter={f}
                    variant="board"
                    side={f.side === ownSide ? "ally" : "enemy"}
                  />
                  {callout && (
                    <span className="combat-callout">
                      {eventLabel(callout, frame, props.locale ?? "th")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {props.battle && (
        <details className="strategy-panel">
          <summary>{LABELS[props.locale ?? "th"].log}</summary>
          <div className="combat-event-log">
            {eventLog.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </details>
      )}
      {currentFighter && (
        <div className="modal-backdrop">
          <section
            className="modal card-inspection"
            role="dialog"
            aria-label="Battle card details"
          >
            <button
              className="close"
              aria-label="Close card details"
              onClick={() => setInspected(undefined)}
            >
              ×
            </button>
            <UnitCard
              unit={{
                defId: currentFighter.defId,
                star: currentFighter.star,
                items: currentFighter.items ?? [],
              }}
              fighter={currentFighter}
              variant="detail"
              side={currentFighter.side === ownSide ? "ally" : "enemy"}
            />
          </section>
        </div>
      )}
    </>
  );
}
