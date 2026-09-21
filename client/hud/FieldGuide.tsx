import { ITEMS, TRAITS, UNITS } from "../../shared/content";
import type { Unit } from "../../shared/types";
import { UnitCard } from "../cards/UnitCard";
import { ITEM_TEXT, TRAIT_NAMES, type Locale } from "../strategy/labels";
export function FieldGuide({
  locale,
  onInspect,
}: {
  locale: Locale;
  onInspect: (unit: Pick<Unit, "defId" | "star" | "items">) => void;
}) {
  const th = locale === "th";
  return (
    <>
      <p>
        {th
          ? "ซื้อและวางตัวละครในพื้นที่ 6×3 ฝั่งคุณ ลงสนามได้ตามเลเวล รวมตัวละครชนิดและดาวเดียวกัน 3 ใบเพื่อเพิ่มดาว จัดแนวหน้าและแนวหลัง แล้วรอดูผลต่อสู้จากเซิร์ฟเวอร์"
          : "Buy and deploy in your 6×3 half, up to your level. Combine three identical recruits of the same star to ascend. Position your frontline and backline, then watch authoritative combat."}
      </p>
      <p>
        {th
          ? "รายได้พื้นฐาน 5 ทอง ดอกเบี้ย 1 ต่อเงินเก็บ 10 ทอง สูงสุด 5 และโบนัสชนะ/แพ้ต่อเนื่อง ซื้อ 4 XP ราคา 4 ทอง ไอเทมเลือกหลังรอบ 1/3/5/7/9 โบนัสทีมหลังรอบ 2/5/8"
          : "Earn 5 base gold, 1 interest per 10 saved (up to 5), and streak bonuses. Buy 4 XP for 4 gold. Item choices follow rounds 1/3/5/7/9; team bonuses follow 2/5/8."}
      </p>
      <h3>{th ? "ตัวละคร · แตะเพื่อดูสกิล" : "Recruits · inspect skills"}</h3>
      <div className="codex-units">
        {UNITS.map((d) => (
          <button
            key={d.id}
            aria-label={(th ? "ดู " : "Inspect ") + d.name}
            onClick={() => onInspect({ defId: d.id, star: 1, items: [] })}
          >
            <UnitCard
              unit={{ defId: d.id, star: 1, items: [] }}
              variant="preview"
            />
          </button>
        ))}
      </div>
      <h3>
        {th
          ? "สายสัมพันธ์ · นับชนิดตัวละครบนสนาม"
          : "Traits · unique deployed recruits"}
      </h3>
      {TRAITS.map((t) => (
        <p key={t.id}>
          <b>{TRAIT_NAMES[t.id]?.[locale] ?? t.id}</b> ·{" "}
          {t.thresholds.join(" / ")} · {t.description}
        </p>
      ))}
      <h3>{th ? "ไอเทม" : "Relics"}</h3>
      {ITEMS.map((i) => (
        <p key={i.id}>
          <b>
            {i.glyph} {i.name}
          </b>{" "}
          · {th ? ITEM_TEXT[i.id] : i.description}
        </p>
      ))}
    </>
  );
}
