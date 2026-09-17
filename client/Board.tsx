import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { COLORS, RULES, UNIT_MAP } from "../shared/content";
import type { Battle, CombatFrame, Unit } from "../shared/types";
import { tone } from "./audio";
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
}
export function Board(props: Props) {
  const mount = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    let lastBattle = "",
      lastTick = -1,
      previous: Record<string, { x: number; y: number; hp: number }> = {};
    let graphics: Phaser.GameObjects.Graphics;
    let labels: Phaser.GameObjects.Text[] = [];
    class Arena extends Phaser.Scene {
      create() {
        graphics = this.add.graphics();
      }
      update() {
        if (!graphics) return;
        const p = latest.current;
        graphics.clear();
        labels.forEach((t) => t.destroy());
        labels = [];
        const g = graphics;
        g.fillStyle(0x101f26);
        g.fillRoundedRect(8, 8, 504, 504, 14);
        g.lineStyle(1, 0x799b8d, 0.25);
        g.strokeRoundedRect(9, 9, 502, 502, 14);
        for (let y = 0; y < 6; y++)
          for (let x = 0; x < 6; x++) {
            const px = OFFSET + x * CELL,
              py = OFFSET + y * CELL;
            g.fillStyle((x + y) % 2 === 0 ? 0x243d41 : 0x1d343a);
            g.fillRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 4);
            g.lineStyle(1, 0x7ca999, 0.12);
            g.strokeRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 4);
            g.fillStyle(0x87b49a, 0.15);
            g.fillCircle(px + 7, py + 7, 1.4);
          }
        g.lineStyle(1, 0xe8c684, 0.4);
        g.lineBetween(OFFSET, 260, 488, 260);
        let frame: CombatFrame | undefined;
        let animate = false;
        if (p.battle) {
          if (lastBattle !== p.battle.id) {
            lastBattle = p.battle.id;
            lastTick = -1;
            previous = {};
          }
          const remaining = p.deadline - (Date.now() + p.serverOffset);
          const elapsed = Math.max(0, p.battle.duration - remaining);
          const index = Math.min(
            p.battle.frames.length - 1,
            Math.floor((elapsed / RULES.tickMs) * p.speed),
          );
          frame = p.battle.frames[index];
          animate = frame.tick !== lastTick;
          lastTick = frame.tick;
        }
        const fighters =
          frame?.units ??
          p.units
            .filter((u) => u.slot < 36)
            .map((u) => ({
              id: u.id,
              defId: u.defId,
              x: u.slot % 6,
              y: Math.floor(u.slot / 6),
              side: 0,
              hp: 1,
              maxHp: 1,
              mana: 0,
              shield: 0,
              star: u.star,
              status: [],
            }));
        for (const u of fighters) {
          const targetX = OFFSET + u.x * CELL + CELL / 2,
            targetY = OFFSET + u.y * CELL + CELL / 2;
          const prev = previous[u.id] ?? { x: targetX, y: targetY, hp: u.hp };
          const x = p.reduced
              ? targetX
              : Phaser.Math.Linear(prev.x, targetX, 0.2),
            y = p.reduced ? targetY : Phaser.Math.Linear(prev.y, targetY, 0.2);
          previous[u.id] = { x, y, hp: u.hp };
          const d = UNIT_MAP[u.defId],
            color = Phaser.Display.Color.HexStringToColor(
              COLORS[d.cost - 1],
            ).color;
          if (u.hp <= 0) {
            g.lineStyle(2, color, 0.18);
            g.strokeCircle(x, y, 13);
            g.lineBetween(x - 7, y - 7, x + 7, y + 7);
            continue;
          }
          const hurt = frame?.events.some(
            (e) => e.type === "damage" && e.target === u.id,
          );
          g.fillStyle(0x040d13, 0.5);
          g.fillEllipse(x, y + 20, 48, 18);
          g.lineStyle(
            p.selected === u.id ? 3 : 1,
            p.selected === u.id ? 0xf2d17d : u.side === 1 ? 0xf39d91 : color,
            0.8,
          );
          g.strokeCircle(x, y + 4, 25);
          g.fillStyle(hurt && !p.reduced ? 0xffffff : 0x14262e);
          g.fillPoints(
            [
              { x: x - 20, y: y - 16 },
              { x, y: y - 28 },
              { x: x + 20, y: y - 16 },
              { x: x + 16, y: y + 15 },
              { x, y: y + 25 },
              { x: x - 16, y: y + 15 },
            ],
            true,
          );
          g.lineStyle(2, color);
          g.strokePoints(
            [
              { x: x - 20, y: y - 16 },
              { x, y: y - 28 },
              { x: x + 20, y: y - 16 },
              { x: x + 16, y: y + 15 },
              { x, y: y + 25 },
              { x: x - 16, y: y + 15 },
            ],
            true,
          );
          g.fillStyle(color);
          g.fillTriangle(x - 13, y - 7, x - 3, y - 3, x - 6, y + 1);
          g.fillTriangle(x + 13, y - 7, x + 3, y - 3, x + 6, y + 1);
          g.fillTriangle(x, y - 21, x - 4, y - 13, x + 4, y - 13);
          const label = this.add
            .text(x, y + 10, d.glyph, {
              fontFamily: "Georgia",
              fontSize: "12px",
              color: COLORS[d.cost - 1],
            })
            .setOrigin(0.5);
          labels.push(label);
          labels.push(
            this.add
              .text(x, y + 34, "★".repeat(u.star), {
                fontSize: "9px",
                color: "#e6c984",
              })
              .setOrigin(0.5),
          );
          if (frame) {
            g.fillStyle(0x061218);
            g.fillRect(x - 23, y - 36, 46, 4);
            g.fillStyle(u.side === 0 ? 0x83dbb7 : 0xf09d8d);
            g.fillRect(x - 23, y - 36, (46 * u.hp) / u.maxHp, 4);
            g.fillStyle(0x8ebfe7);
            g.fillRect(x - 23, y - 30, (46 * u.mana) / 100, 2);
            if (u.shield) {
              g.lineStyle(2, 0xc0dced, 0.6);
              g.strokeCircle(x, y, 29);
            }
            if (u.status.length)
              labels.push(
                this.add
                  .text(x, y - 47, u.status.join(" "), {
                    fontSize: "9px",
                    color: "#ebc988",
                  })
                  .setOrigin(0.5),
              );
          }
        }
        if (frame && !p.reduced) {
          for (const e of frame.events) {
            const s = previous[e.source],
              t = e.target ? previous[e.target] : undefined;
            if (s && t && (e.type === "attack" || e.type === "cast")) {
              g.lineStyle(
                e.type === "cast" ? 4 : 2,
                e.type === "cast" ? 0xc4a4fa : 0xecd99d,
                0.7,
              );
              g.lineBetween(s.x, s.y, t.x, t.y);
              if (animate) tone(p.sound, e.type);
            }
            if (t && e.type === "damage" && e.value)
              labels.push(
                this.add.text(t.x + 15, t.y - 22, `${e.value}`, {
                  fontSize: "12px",
                  color: e.text === "magic" ? "#c9b2ff" : "#ffcf9b",
                }),
              );
          }
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
  return (
    <div className="arena" ref={mount}>
      <div className="board-input" role="grid" aria-label="6 by 6 battlefield">
        {Array.from({ length: 36 }, (_, slot) => {
          const unit = props.units.find((u) => u.slot === slot);
          return (
            <button
              key={slot}
              role="gridcell"
              className={`tile ${unit && unit.id === props.selected ? "selected" : ""} ${props.selected && !props.disabled ? "available" : ""}`}
              data-slot={slot}
              data-unit={unit?.id}
              aria-label={`Tile ${slot + 1}${unit ? `: ${UNIT_MAP[unit.defId].name}` : ""}`}
              disabled={props.disabled}
              onClick={() =>
                unit && !props.selected
                  ? props.onSelect(unit.id)
                  : props.onSlot(slot)
              }
              draggable={!!unit && !props.disabled}
              onDragStart={(e) => {
                if (unit) {
                  props.onSelect(unit.id);
                  e.dataTransfer.setData("unit", unit.id);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const item = e.dataTransfer.getData("item");
                props.onDrop(
                  slot,
                  e.dataTransfer.getData("unit") || undefined,
                  item ? Number(item) : undefined,
                );
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
