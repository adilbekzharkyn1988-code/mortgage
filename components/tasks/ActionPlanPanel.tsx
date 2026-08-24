"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Plus } from "lucide-react";
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskFilter,
  TaskListItem,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/types/task";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { taskService } from "@/lib/services/taskService";
import { formatDateShort } from "@/lib/format";

interface ActionPlanPanelProps {
  caseId: string;
  onTaskCreate?: () => void;
  onTaskUpdate?: (task: Task) => void;
}

type ViewMode = "all" | "new" | "in_progress" | "done" | "overdue";

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: "all", label: "Все" },
  { mode: "new", label: "Новые" },
  { mode: "in_progress", label: "В работе" },
  { mode: "done", label: "Выполнено" },
  { mode: "overdue", label: "Просрочено" },
];

function getFilter(mode: ViewMode): TaskFilter {
  switch (mode) {
    case "new":
      return { status: ["new"] };
    case "in_progress":
      return { status: ["in_progress"] };
    case "done":
      return { status: ["done"] };
    case "overdue":
      return { overdue: true };
    default:
      return { status: ["new", "in_progress", "done"] };
  }
}

export function ActionPlanPanel({ caseId, onTaskCreate, onTaskUpdate }: ActionPlanPanelProps) {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [stats, setStats] = useState({ total: 0, done: 0, inProgress: 0, fresh: 0, overdue: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const filtered = await taskService.getFilteredTasks(caseId, getFilter(viewMode), {
      by: "dueDate",
      order: "asc",
    });
    setTasks(filtered);

    const all = await taskService.getByCaseId(caseId);
    setStats({
      total: all.length,
      done: all.filter((t) => t.status === "done").length,
      inProgress: all.filter((t) => t.status === "in_progress").length,
      fresh: all.filter((t) => t.status === "new").length,
      overdue: all.filter((t) => taskService.isOverdue(t)).length,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, viewMode]);

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    const updated = await taskService.setStatus(taskId, status);
    if (updated) {
      onTaskUpdate?.(updated);
      await load();
    }
  };

  const handlePriorityChange = async (taskId: string, priority: TaskPriority) => {
    const updated = await taskService.update(taskId, { priority });
    if (updated) {
      onTaskUpdate?.(updated);
      await load();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader eyebrow="План действий" title="Список задач" />
        <div className="flex items-center justify-center p-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader eyebrow="План действий" title="Список задач" />
      <div className="flex flex-col gap-5 p-5">
        {/* Статистика */}
        {stats.total > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Всего: {stats.total}</Badge>
            {stats.done > 0 && <Badge tone="success">Выполнено: {stats.done}</Badge>}
            {stats.inProgress > 0 && <Badge tone="warn">В работе: {stats.inProgress}</Badge>}
            {stats.fresh > 0 && <Badge tone="navy">Новых: {stats.fresh}</Badge>}
            {stats.overdue > 0 && <Badge tone="risk">Просрочено: {stats.overdue}</Badge>}
          </div>
        )}

        {/* Фильтры */}
        <div className="flex flex-wrap gap-2">
          {VIEW_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? "bg-navy text-white"
                  : "bg-surface-sunken text-ink-soft hover:bg-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Список задач */}
        <div className="flex flex-col gap-2">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface-sunken p-4 text-center">
              <p className="text-sm text-ink-faint">Нет задач в этом разделе</p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
              />
            ))
          )}
        </div>

        {onTaskCreate && (
          <button
            onClick={onTaskCreate}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-sunken p-3 transition-colors hover:border-navy hover:bg-surface"
          >
            <Plus size={16} className="text-navy" />
            <span className="text-xs font-medium text-navy">Добавить задачу</span>
          </button>
        )}
      </div>
    </Card>
  );
}

function TaskCard({
  task,
  onStatusChange,
  onPriorityChange,
}: {
  task: TaskListItem;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onPriorityChange: (taskId: string, priority: TaskPriority) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-sunken p-4 transition-colors hover:border-line-strong hover:bg-surface">
      <div className="flex items-start gap-3">
        <button
          onClick={() => onStatusChange(task.id, task.status === "done" ? "new" : "done")}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            task.status === "done"
              ? "border-success bg-success-soft text-success"
              : "border-line-strong bg-surface hover:border-navy"
          }`}
        >
          {task.status === "done" && <CheckCircle2 size={14} />}
        </button>

        <div className="min-w-0 flex-1">
          <h4
            className={`text-sm font-semibold ${
              task.status === "done" ? "text-ink-faint line-through" : "text-ink"
            }`}
          >
            {task.title}
          </h4>
          {task.description && (
            <p className="mt-1 line-clamp-1 text-xs text-ink-faint">{task.description}</p>
          )}
        </div>

        <select
          value={task.priority}
          onChange={(e) => onPriorityChange(task.id, e.target.value as TaskPriority)}
          disabled={task.status === "done" || task.status === "cancelled"}
          className="rounded border border-line-strong bg-surface px-2 py-1 text-xs font-medium text-ink"
        >
          {(["high", "medium", "low"] as TaskPriority[]).map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {task.dueDate && (
          <span
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${
              task.isOverdue ? "bg-risk-soft font-semibold text-risk" : "bg-surface text-ink-faint"
            }`}
          >
            <Clock size={12} />
            {task.isOverdue
              ? `Просрочено на ${Math.abs(task.daysUntilDue ?? 0)} дн.`
              : formatDateShort(task.dueDate)}
          </span>
        )}

        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          className="rounded border border-line-strong bg-surface px-2 py-1 text-xs font-medium text-ink"
        >
          {(["new", "in_progress", "done", "cancelled"] as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {task.origin === "ai_recommendation" && <Badge tone="brass">AI</Badge>}
      </div>
    </div>
  );
}
