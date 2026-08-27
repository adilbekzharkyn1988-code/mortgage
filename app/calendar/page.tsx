"use client";

// ЭТАП 6, п.6.14: раздел "Календарь/планирование" — использует существующие
// задачи (taskService через aggregations), без внешних интеграций.

import { useEffect, useState } from "react";
import { getGlobalTaskOverview, GlobalTaskOverview } from "@/lib/aggregations";
import { Card, CardHeader } from "@/components/ui/Card";
import { TaskCalendar } from "@/components/tasks/TaskCalendar";

export default function CalendarPage() {
  const [overview, setOverview] = useState<GlobalTaskOverview | null>(null);

  useEffect(() => {
    getGlobalTaskOverview().then(setOverview);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Рабочее пространство
        </p>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Календарь</h1>
        <p className="mt-1 text-sm text-ink-soft">Задачи по всем делам, сгруппированные по дате.</p>
      </div>

      <Card>
        <CardHeader eyebrow="Планирование" title="Задачи по датам" />
        <div className="p-5">
          {overview === null ? (
            <p className="py-8 text-center text-sm text-ink-soft">Загрузка…</p>
          ) : (
            <TaskCalendar tasks={overview.all} />
          )}
        </div>
      </Card>
    </div>
  );
}
