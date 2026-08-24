import { ReactNode } from "react";
import { Card } from "./ui/Card";

export function StatCard({
  label,
  value,
  icon,
  tone = "navy",
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: "navy" | "brass" | "risk" | "success";
}) {
  const ICON_TONE: Record<string, string> = {
    navy: "bg-navy-soft text-navy",
    brass: "bg-brass-soft text-brass",
    risk: "bg-risk-soft text-risk",
    success: "bg-success-soft text-success",
  };

  return (
    <Card className="flex items-center gap-4 px-5 py-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${ICON_TONE[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-data text-2xl font-medium leading-none text-ink">{value}</p>
        <p className="mt-1.5 truncate text-xs text-ink-soft">{label}</p>
      </div>
    </Card>
  );
}
