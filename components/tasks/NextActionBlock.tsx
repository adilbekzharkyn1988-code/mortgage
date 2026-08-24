"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Clock, Flag } from "lucide-react";
import { Task, TASK_PRIORITY_LABELS, TaskPriority } from "@/types/task";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { taskService } from "@/lib/services/taskService";
import { formatDateShort } from "@/lib/format";

interface NextActionBlockProps {
  caseId: string;
  onTaskClick?: (task: Task) => void;
}

const PRIORITY_TONE: Record<TaskPriority, "risk" | "warn" | "success"> = {
  high: "risk",
  medium: "warn",
  low: "success",
};

export function NextActionBlock({ caseId, onTaskClick }: NextActionBlockProps) {
  const [nextAction, setNextAction] = useState<Task | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    taskService.getNextAction(caseId).then((result) => {
      if (cancelled) return;
      setNextAction(result.task);
      setReason(result.reason);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (loading) {
    return (
      <Card>
        <CardHeader eyebrow="План действий" title="Следующее действие" />
        <div className="flex items-center justify-center p-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
        </div>
      </Card>
    );
  }

  if (!nextAction) {
    return (
      <Card>
        <CardHeader eyebrow="План действий" title="Следующее действие" />
        <div className="p-5">
          <div className="rounded-lg border border-line bg-surface-sunken p-4 text-center">
            <p className="text-sm text-ink-soft">Следующее действие не назначено</p>
            <p className="mt-1 text-xs text-ink-faint">
              Все активные задачи выполнены, либо в плане пока нет задач
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const daysUntilDue = nextAction.dueDate ? taskService.daysUntilDue(nextAction.dueDate) : null;
  const isOverdue = taskService.isOverdue(nextAction);

  return (
    <Card>
      <CardHeader eyebrow="План действий" title="Следующее действие" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-faint">{reason}</span>
          {isOverdue && <Badge tone="risk">Просрочено</Badge>}
        </div>

        <button
          onClick={() => onTaskClick?.(nextAction)}
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface-sunken p-4 text-left transition-all hover:border-line-strong hover:bg-surface"
        >
          <h3 className="text-sm font-semibold text-ink">{nextAction.title}</h3>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PRIORITY_TONE[nextAction.priority]}>
              <Flag size={12} />
              {TASK_PRIORITY_LABELS[nextAction.priority]}
            </Badge>

            {nextAction.dueDate && (
              <span
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${
                  isOverdue ? "bg-risk-soft font-semibold text-risk" : "bg-surface text-ink-faint"
                }`}
              >
                <Clock size={12} />
                {isOverdue
                  ? `Просрочено на ${Math.abs(daysUntilDue ?? 0)} дн.`
                  : formatDateShort(nextAction.dueDate)}
              </span>
            )}

            <Badge tone="neutral">
              {nextAction.origin === "ai_recommendation" ? "AI-рекомендация" : "Вручную"}
            </Badge>
          </div>

          {nextAction.description && (
            <p className="text-xs text-ink-soft line-clamp-2">{nextAction.description}</p>
          )}

          <div className="flex items-center gap-1.5 pt-1 text-xs font-medium text-navy">
            Открыть задачу
            <ChevronRight size={14} />
          </div>
        </button>
      </div>
    </Card>
  );
}
