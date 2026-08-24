import { ReactNode } from "react";

type BadgeTone = "navy" | "success" | "warn" | "risk" | "neutral" | "brass";

const TONE_CLASSES: Record<BadgeTone, string> = {
  navy: "bg-navy-soft text-navy border-navy/10",
  success: "bg-success-soft text-success border-success/15",
  warn: "bg-warn-soft text-warn border-warn/15",
  risk: "bg-risk-soft text-risk border-risk/15",
  neutral: "bg-surface-sunken text-ink-soft border-line-strong",
  brass: "bg-brass-soft text-brass border-brass/20",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
