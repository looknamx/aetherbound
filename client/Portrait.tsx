import { COLORS, UNIT_MAP } from "../shared/content";
export function Portrait({
  id,
  small = false,
}: {
  id: string;
  small?: boolean;
}) {
  const d = UNIT_MAP[id],
    index = Object.keys(UNIT_MAP).indexOf(id),
    color = COLORS[d.cost - 1];
  return (
    <svg
      className={small ? "portrait small" : "portrait"}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ "--unit-color": color } as React.CSSProperties}
    >
      <circle cx="50" cy="48" r="37" fill={color} opacity=".07" />
      <path
        d="M50 4 87 26 87 70 50 94 13 70 13 26Z"
        fill="none"
        stroke={color}
        opacity=".2"
      />
      <path
        d={`M${20 + (index % 4) * 3} 85 30 63 70 63 ${80 - (index % 4) * 3} 85Z`}
        fill={color}
        opacity=".45"
      />
      <path
        d={
          d.class === "Warden"
            ? "M25 25 50 14 75 25 71 58 50 75 29 58Z"
            : d.class === "Ranger"
              ? "M23 49 50 12 77 49 65 70 35 70Z"
              : d.class === "Arcanist"
                ? "M50 8 76 63 50 78 24 63Z"
                : d.class === "Weaver"
                  ? "M50 16 70 35 67 64 50 78 33 64 30 35Z"
                  : "M20 29 40 35 50 17 60 35 80 29 68 64 50 78 32 64Z"
        }
        fill="#182b32"
        stroke={color}
        strokeWidth="2"
      />
      <path
        d="M32 45 46 49 42 54 32 51 M68 45 54 49 58 54 68 51"
        fill={color}
      />
      <path d="M50 49 45 64 55 64Z" fill={color} opacity=".6" />
      <path
        d={index % 2 ? "M41 24 50 35 59 24" : "M50 20 56 30 50 40 44 30Z"}
        fill={color}
      />
      <path d="M28 82 50 73 72 82" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
