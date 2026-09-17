import { useEffect, useRef, useState } from "react";
import type { DeployMove, Snapshot } from "../../shared/types";
export interface CardFlight {
  id: string;
  unit: DeployMove;
  x: number;
  y: number;
  dx: number;
  dy: number;
}
/** Animate observed preparation -> battle transitions, never restored snapshots. */
export function useAutoDeployFeedback(
  state: Snapshot | undefined,
  reduced: boolean,
) {
  const previous = useRef<Snapshot | undefined>(undefined),
    seen = useRef(new Set<string>());
  const [flights, setFlights] = useState<CardFlight[]>([]);
  useEffect(() => {
    const old = previous.current;
    previous.current = state;
    if (!state) return;
    const report = state.room.deployments?.find(
      (r) => r.playerId === state.you && r.round === state.room.round,
    );
    if (!report || seen.current.has(report.id)) return;
    seen.current.add(report.id);
    if (
      !old ||
      old.room.phase !== "Preparing" ||
      state.room.phase !== "Battling" ||
      reduced ||
      !report.moves.length
    )
      return;
    const moves = report.moves
      .map((move) => {
        const bench = document
          .querySelector(`[data-slot="${move.fromSlot}"]`)
          ?.getBoundingClientRect();
        const tile = document
          .querySelector(`[data-slot="${move.toSlot}"]`)
          ?.getBoundingClientRect();
        if (!bench || !tile) return undefined;
        return {
          id: `${report.id}:${move.unitId}`,
          unit: move,
          x: bench.x,
          y: bench.y,
          dx: tile.x - bench.x,
          dy: tile.y - bench.y,
        };
      })
      .filter((f): f is CardFlight => !!f);
    setFlights(moves);
  }, [state, reduced]);
  useEffect(() => {
    if (!flights.length) return;
    const timer = setTimeout(() => setFlights([]), 500);
    return () => clearTimeout(timer);
  }, [flights]);
  return flights;
}
