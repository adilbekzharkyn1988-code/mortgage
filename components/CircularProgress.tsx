// Круговой индикатор прогресса дела — заменяет плоскую линейную полосу.
// В центре — сам процент, вокруг — тонкое кольцо. Цвет кольца сигнализирует
// о состоянии дела (обычное / требует внимания), а не только цифра.

const SIZE = 56;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;

export function CircularProgress({
  percent,
  tone = "navy",
  size = SIZE,
}: {
  percent: number;
  tone?: "navy" | "risk" | "success";
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const scale = size / SIZE;
  const radius = RADIUS * scale;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    tone === "risk"
      ? "var(--color-risk)"
      : tone === "success"
        ? "var(--color-success)"
        : "var(--color-navy)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-sunken)"
          strokeWidth={STROKE * scale}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={STROKE * scale}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-data text-[13px] font-semibold text-ink">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}
