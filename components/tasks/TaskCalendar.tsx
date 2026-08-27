"use client";

// ЭТАП 6, п.6.14: простой внутренний календарь задач — месяц + список задач
// выбранного дня. Модель задач хранит только дату (без времени), поэтому
// календарь показывает задачи как список на день, без временной сетки.

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { TaskWithContext } from "@/lib/aggregations";
import { Badge } from "@/components/ui/Badge";
import { TASK_PRIORITY_LABELS } from "@/types/task";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  // Понедельник = начало недели.
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

export function TaskCalendar({ tasks }: { tasks: TaskWithContext[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(dateKey(today));

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithContext[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = task.dueDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const grid = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const selectedTasks = tasksByDate.get(selectedKey) ?? [];
  const todayKeyValue = dateKey(today);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-sunken"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="font-display text-base text-ink">
            {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
          </p>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-sunken"
            aria-label="Следующий месяц"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((day) => {
            const key = dateKey(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const dayTasks = tasksByDate.get(key) ?? [];
            const hasOverdue = dayTasks.some((t) => t.isOverdue);
            const isSelected = key === selectedKey;

            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`flex min-h-[64px] flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors ${
                  isSelected
                    ? "border-navy bg-navy-soft"
                    : "border-line bg-surface hover:border-line-strong"
                } ${!inMonth ? "opacity-40" : ""}`}
              >
                <span
                  className={`text-xs ${
                    key === todayKeyValue ? "font-semibold text-navy" : "text-ink-soft"
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      hasOverdue ? "bg-risk-soft text-risk" : "bg-navy-soft text-navy"
                    }`}
                  >
                    {dayTasks.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          {new Date(selectedKey).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
          })}
        </p>
        {selectedTasks.length === 0 ? (
          <p className="text-sm text-ink-soft">На эту дату задач нет.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selectedTasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/clients/${task.clientId}`}
                  className="flex flex-col gap-1 rounded-lg border border-line bg-surface-sunken px-3 py-2.5 transition-colors hover:border-line-strong"
                >
                  <p className="text-sm font-medium text-ink">{task.title}</p>
                  <p className="text-xs text-ink-faint">{task.clientName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      tone={
                        task.priority === "high"
                          ? "risk"
                          : task.priority === "medium"
                          ? "warn"
                          : "neutral"
                      }
                    >
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </Badge>
                    {task.isOverdue && (
                      <span className="flex items-center gap-1 text-xs text-risk">
                        <Clock size={11} />
                        Просрочено
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
