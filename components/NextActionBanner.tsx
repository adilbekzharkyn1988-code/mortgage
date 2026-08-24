import { AlertTriangle, ArrowRight } from "lucide-react";
import { Task, TASK_PRIORITY_LABELS } from "@/types/task";
import { formatDate } from "@/lib/format";
import { Badge } from "./ui/Badge";

export function NextActionBanner({ task }: { task: Task | null }) {
  if (!task) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3 text-sm text-warn">
        <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0" />
        <span className="font-medium">Следующее действие не назначено.</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-navy/15 bg-navy-soft px-4 py-3 text-sm">
      <ArrowRight size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-navy" />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-navy/70">
          Следующее действие
        </p>
        <p className="font-medium text-ink">{task.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge tone={task.priority === "high" ? "risk" : task.priority === "medium" ? "warn" : "neutral"}>
            {TASK_PRIORITY_LABELS[task.priority]} приоритет
          </Badge>
          {task.dueDate && (
            <span className="text-xs text-ink-soft">до {formatDate(task.dueDate)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
