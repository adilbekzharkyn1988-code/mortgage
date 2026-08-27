"use client";

// ЭТАП 6, п.6.15–6.20: Dashboard как рабочая панель консультанта —
// верхние показатели, воронка ипотеки, "Требует внимания", финансы
// (ЭТАП 5, без изменений логики) и быстрые действия.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  FolderClock,
  CalendarCheck,
  AlertTriangle,
  Wallet,
  Banknote,
  Receipt,
  CalendarDays,
  UserPlus,
  ListPlus,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  getClientOverviews,
  getFinanceOverview,
  getFunnelCounts,
  getGlobalTaskOverview,
  ClientOverview,
  DashboardFinanceOverview,
  GlobalTaskOverview,
} from "@/lib/aggregations";
import { CASE_STAGE_LABELS, CASE_STAGE_ORDER } from "@/types/mortgageCase";
import { StatCard } from "@/components/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton, Button } from "@/components/ui/Button";
import { QuickAddTaskModal } from "@/components/tasks/QuickAddTaskModal";
import { formatDate, formatTenge } from "@/lib/format";

export default function DashboardPage() {
  const [overviews, setOverviews] = useState<ClientOverview[] | null>(null);
  const [finance, setFinance] = useState<DashboardFinanceOverview | null>(null);
  const [taskOverview, setTaskOverview] = useState<GlobalTaskOverview | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);

  const reload = () => {
    getClientOverviews().then(setOverviews);
    getFinanceOverview().then(setFinance);
    getGlobalTaskOverview().then(setTaskOverview);
  };

  useEffect(() => {
    reload();
  }, []);

  const stats = useMemo(() => {
    if (!overviews) return null;
    return {
      totalClients: overviews.length,
      activeCases: overviews.filter((o) => o.isActive).length,
    };
  }, [overviews]);

  const funnel = useMemo(() => (overviews ? getFunnelCounts(overviews) : null), [overviews]);
  const maxFunnelCount = funnel ? Math.max(1, ...Object.values(funnel)) : 1;

  // ЭТАП 6, п.6.17: агрегированные показатели "Требует внимания".
  const attention = useMemo(() => {
    if (!overviews) return null;
    return {
      overdueTasks: overviews.reduce((sum, o) => sum + o.overdueTasksCount, 0),
      missingNextAction: overviews.filter((o) => o.mortgageCase && !o.mortgageCase.nextActionTaskId)
        .length,
      awaitingDocuments: overviews.filter((o) => o.missingDocumentTypes.length > 0).length,
      highRisk: overviews.reduce((sum, o) => sum + o.highRiskCount, 0),
      discrepancies: overviews.reduce(
        (sum, o) => sum + (o.mortgageCase?.discrepancies.length ?? 0),
        0
      ),
    };
  }, [overviews]);

  const recentlyUpdated = overviews?.slice(0, 6) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Обзор
          </p>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">Дашборд</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Текущее состояние клиентов и ипотечных дел.
          </p>
        </div>
        {/* ЭТАП 6, п.6.19: быстрые действия — используем существующие формы,
            не дублируем их (создание дела происходит вместе с созданием клиента). */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowAddTask(true)}>
            <ListPlus size={16} />
            Добавить задачу
          </Button>
          <LinkButton href="/clients/new">
            <UserPlus size={16} />
            Новый клиент
          </LinkButton>
        </div>
      </div>

      {/* 6.15 — верхние показатели */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Клиенты"
          value={stats?.totalClients ?? "—"}
          icon={<Users size={20} strokeWidth={1.75} />}
          tone="navy"
        />
        <StatCard
          label="Активные дела"
          value={stats?.activeCases ?? "—"}
          icon={<FolderClock size={20} strokeWidth={1.75} />}
          tone="brass"
        />
        <Link href="/tasks">
          <StatCard
            label="Сегодня"
            value={taskOverview?.today.length ?? "—"}
            icon={<CalendarCheck size={20} strokeWidth={1.75} />}
            tone="navy"
          />
        </Link>
        <Link href="/tasks">
          <StatCard
            label="Просрочено"
            value={taskOverview?.overdue.length ?? "—"}
            icon={<AlertTriangle size={20} strokeWidth={1.75} />}
            tone="risk"
          />
        </Link>
      </div>

      {/* 6.16 — воронка ипотеки, использует существующие этапы CaseStage */}
      <Card>
        <CardHeader eyebrow="Воронка" title="Воронка ипотеки" />
        <div className="flex flex-col gap-3 p-5">
          {funnel === null && <p className="text-sm text-ink-soft">Загрузка…</p>}
          {funnel &&
            CASE_STAGE_ORDER.map((stage) => (
              <Link
                key={stage}
                href={`/clients?stage=${stage}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-sunken"
              >
                <span className="w-36 shrink-0 text-sm text-ink-soft sm:w-44">
                  {CASE_STAGE_LABELS[stage]}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full bg-navy transition-all"
                    style={{ width: `${(funnel[stage] / maxFunnelCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-data text-sm text-ink">
                  {funnel[stage]}
                </span>
              </Link>
            ))}
        </div>
      </Card>

      {/* 6.17 — требует внимания (агрегированные показатели, каждый кликабелен) */}
      <Card>
        <CardHeader eyebrow="Требует внимания" title="Проблемы по всем делам" />
        <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-5">
          <Link href="/tasks">
            <StatCard
              label="Просроченные задачи"
              value={attention?.overdueTasks ?? "—"}
              icon={<AlertTriangle size={18} strokeWidth={1.75} />}
              tone="risk"
            />
          </Link>
          <Link href="/clients?quick=needs_attention">
            <StatCard
              label="Без следующего действия"
              value={attention?.missingNextAction ?? "—"}
              icon={<AlertTriangle size={18} strokeWidth={1.75} />}
              tone="brass"
            />
          </Link>
          <Link href="/clients?quick=awaiting_documents">
            <StatCard
              label="Ожидают документы"
              value={attention?.awaitingDocuments ?? "—"}
              icon={<AlertTriangle size={18} strokeWidth={1.75} />}
              tone="navy"
            />
          </Link>
          <Link href="/clients?quick=needs_attention">
            <StatCard
              label="Высокий риск"
              value={attention?.highRisk ?? "—"}
              icon={<AlertTriangle size={18} strokeWidth={1.75} />}
              tone="risk"
            />
          </Link>
          <Link href="/clients?quick=needs_attention">
            <StatCard
              label="Расхождения"
              value={attention?.discrepancies ?? "—"}
              icon={<AlertTriangle size={18} strokeWidth={1.75} />}
              tone="brass"
            />
          </Link>
        </div>
        {finance && finance.remaining > 0 && (
          <div className="border-t border-line px-5 py-3.5">
            <Link
              href="/clients?quick=needs_attention"
              className="flex items-center justify-between text-sm"
            >
              <span className="text-ink-soft">Неоплаченный остаток по всем делам</span>
              <span className="font-data font-medium text-ink">
                {formatTenge(finance.remaining)}
              </span>
            </Link>
          </div>
        )}
      </Card>

      {/* 6.18 — финансы (ЭТАП 5, логика не менялась) */}
      <Card>
        <CardHeader eyebrow="Финансы" title="Начисления и оплаты по всем делам" />
        <div className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-5">
          <StatCard
            label="Начислено"
            value={finance ? formatTenge(finance.totalAccrued) : "—"}
            icon={<Wallet size={20} strokeWidth={1.75} />}
            tone="navy"
          />
          <StatCard
            label="Оплачено"
            value={finance ? formatTenge(finance.totalPaid) : "—"}
            icon={<Banknote size={20} strokeWidth={1.75} />}
            tone="success"
          />
          <StatCard
            label="Остаток"
            value={finance ? formatTenge(finance.remaining) : "—"}
            icon={<Receipt size={20} strokeWidth={1.75} />}
            tone="brass"
          />
          <StatCard
            label="Оплаты сегодня"
            value={finance ? formatTenge(finance.paidToday) : "—"}
            icon={<CalendarDays size={20} strokeWidth={1.75} />}
            tone="navy"
          />
          <StatCard
            label="Оплаты за месяц"
            value={finance ? formatTenge(finance.paidThisMonth) : "—"}
            icon={<CalendarDays size={20} strokeWidth={1.75} />}
            tone="brass"
          />
        </div>
      </Card>

      {/* 6.12 / 6.11 — задачи на сегодня и просроченные, компактно */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Сегодня" title="Задачи на сегодня" />
          <div className="divide-y divide-line">
            {taskOverview && taskOverview.today.length === 0 && (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-ink-soft">
                <CheckCircle2 size={16} className="text-success" />
                На сегодня задач нет.
              </p>
            )}
            {taskOverview?.today.slice(0, 5).map((task) => (
              <Link
                key={task.id}
                href={`/clients/${task.clientId}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{task.title}</p>
                  <p className="truncate text-xs text-ink-faint">{task.clientName}</p>
                </div>
              </Link>
            ))}
          </div>
          {taskOverview && taskOverview.today.length > 5 && (
            <Link href="/tasks" className="block px-5 py-2.5 text-xs text-navy hover:underline">
              Показать все ({taskOverview.today.length})
            </Link>
          )}
        </Card>

        <Card>
          <CardHeader eyebrow="Просрочено" title="Просроченные задачи" />
          <div className="divide-y divide-line">
            {taskOverview && taskOverview.overdue.length === 0 && (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-ink-soft">
                <CheckCircle2 size={16} className="text-success" />
                Все задачи выполнены вовремя.
              </p>
            )}
            {taskOverview?.overdue.slice(0, 5).map((task) => (
              <Link
                key={task.id}
                href={`/clients/${task.clientId}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{task.title}</p>
                  <p className="truncate text-xs text-ink-faint">{task.clientName}</p>
                </div>
                {task.dueDate && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-risk">
                    <Clock size={12} />
                    {formatDate(task.dueDate)}
                  </span>
                )}
              </Link>
            ))}
          </div>
          {taskOverview && taskOverview.overdue.length > 5 && (
            <Link href="/tasks" className="block px-5 py-2.5 text-xs text-navy hover:underline">
              Показать все ({taskOverview.overdue.length})
            </Link>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Последние обновления" title="Активные дела" />
        <div className="divide-y divide-line">
          {overviews === null && (
            <p className="px-5 py-6 text-sm text-ink-soft">Загрузка…</p>
          )}
          {overviews !== null && overviews.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <p className="font-medium text-ink">Нет клиентов</p>
              <p className="text-sm text-ink-soft">
                Добавьте первого клиента, чтобы начать работу.
              </p>
              <LinkButton href="/clients/new">
                <UserPlus size={16} />
                Добавить клиента
              </LinkButton>
            </div>
          )}
          {recentlyUpdated.map(({ client, mortgageCase, needsAttention }) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{client.fullName}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {mortgageCase ? CASE_STAGE_LABELS[mortgageCase.stage] : "Без дела"} · обновлено{" "}
                  {formatDate(client.updatedAt)}
                </p>
              </div>
              {needsAttention ? (
                <Badge tone="risk">Требует внимания</Badge>
              ) : (
                <Badge tone="success">В норме</Badge>
              )}
            </Link>
          ))}
        </div>
      </Card>

      {showAddTask && (
        <QuickAddTaskModal
          onClose={() => setShowAddTask(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}
