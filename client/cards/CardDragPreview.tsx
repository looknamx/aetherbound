import type { DragEvent } from "react";
import type { Unit } from "../../shared/types";
import { UnitCard } from "./UnitCard";
export function CardDragPreview({ units }: { units: Unit[] }) {
  return (
    <div className="drag-preview-bank" aria-hidden="true">
      {units.map((u) => (
        <div key={u.id} data-drag-preview={u.id}>
          <UnitCard unit={u} variant="drag" />
        </div>
      ))}
    </div>
  );
}
export function setCardDragImage(event: DragEvent, unitId: string) {
  const node = Array.from(
    document.querySelectorAll<HTMLElement>("[data-drag-preview]"),
  ).find((n) => n.dataset.dragPreview === unitId);
  if (node) event.dataTransfer.setDragImage(node, 65, 75);
}
