"use client";

// ЭТАП 6, п.6.9–6.13: полноценный раздел "Задачи" — сквозной список задач
// по всем делам (используется существующий taskService/aggregations),
// с фильтрами по статусу/приоритету, блоками "Сегодня" и "Просрочено".

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock } from "lucide-react";
import {
  getGlobalTaskOverview,
  GlobalTaskOverview,
  TaskWithContext,
} from "@/lib/aggregations";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TaskPriority,
  TaskStatus,
} from "@/types/task";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SelectInput } from "@/components/ui/FormField";
import { formatDate } from "@/lib/format";

type StatusFilter = "all" | TaskStatus;
type PriorityFilter = "all" | TaskPriority;

function TaskRow({ task }: { task: TaskWithContext }) {
  return (
    <Link
      href={`/clients/${task.clientId}`}
      className="flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            task.status === "done" ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{task.clientName}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Badge tone={task.priority === "high" ? "risk" : task.priority === "medium" ? "warn" : "neutral"}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>
        <Badge tone={task.status === "done" ? "success" : task.isOverdue ? "risk" : "navy"}>
          {task.isOverdue ? "Просрочено" : TASK_STATUS_LABELS[task.status]}
        </Badge>
        {task.dueDate && (
          <span className="flex items-center gap-1 text-xs text-ink-faint">
            <Clock size={12} />
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function TasksPage() {
  const [overview, setOverview] = useState<GlobalTaskOverview | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");

  useEffect(() => {
    getGlobalTaskOverview().then(setOverview);
  }, []);

  const filtered = useMemo(() => {
    if (!overview) return [];
    return overview.all
      .filter((t) => statusFilter === "all" || t.status === statusFilter)
      .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
      .sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.createdAt < b.createdAt ? 1 : -1;
      });
  }, [overview, statusFilter, priorityFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Рабочее пространство
        </p>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Задачи</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {overview ? `Всего задач: ${overview.all.length}` : "Загрузка…"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Сегодня"
            title={`Задачи на сегодня (${overview?.today.length ?? 0})`}
          />
          <div className="divide-y divide-line">
            {overview && overview.today.length === 0 && (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-ink-soft">
                <CheckCircle2 size={16} className="text-success" />
                На сегодня задач нет.
              </p>
            )}
            {overview?.today.map((task) => <TaskRow key={task.id} task={task} />)}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Просрочено"
            title={`Просроченные задачи (${overview?.overdue.length ?? 0})`}
          />
          <div className="divide-y divide-line">
            {overview && overview.overdue.length === 0 && (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-ink-soft">
                <CheckCircle2 size={16} className="text-success" />
                Все задачи выполнены вовремя.
              </p>
            )}
            {overview?.overdue.map((task) => <TaskRow key={task.id} task={task} />)}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Все задачи" title="Список задач по всем делам" />
        <div className="flex flex-wrap gap-3 border-b border-line px-5 py-3.5">
          <SelectInput
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-auto"
          >
            <option value="all">Все статусы</option>
            {(Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            className="w-auto"
          >
            <option value="all">Все приоритеты</option>
            {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="divide-y divide-line">
          {overview === null && (
            <p className="px-5 py-8 text-center text-sm text-ink-soft">Загрузка…</p>
          )}
          {overview !== null && overview.all.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <CalendarClock size={24} className="text-ink-faint" />
              <p className="font-medium text-ink">Нет задач</p>
              <p className="text-sm text-ink-soft">
                Задачи появятся здесь после создания в карточке дела.
              </p>
            </div>
          )}
          {overview !== null && overview.all.length > 0 && filtered.length === 0 && (
            <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-ink-soft">
              <AlertTriangle size={14} />
              Ничего не найдено по заданным фильтрам.
            </p>
          )}
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </Card>
    </div>
  );
}
