"use client";

// Дашборд как рабочий стол консультанта: система сама ведёт по следующему
// шагу (очередь "Что делать сейчас"), а не заставляет искать проблему
// по вкладкам. Ниже — лёгкая, компактная сводка по всем клиентам.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  FolderClock,
  CalendarCheck,
  AlertTriangle,
  UserPlus,
  ListPlus,
  ArrowRight,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import {
  getActionQueue,
  getClientOverviews,
  getFinanceOverview,
  getGlobalTaskOverview,
  ActionQueueItem,
  ActionSeverity,
  ClientOverview,
  DashboardFinanceOverview,
  GlobalTaskOverview,
} from "@/lib/aggregations";
import { CASE_STAGE_LABELS } from "@/types/mortgageCase";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton, Button } from "@/components/ui/Button";
import { CircularProgress } from "@/components/CircularProgress";
import { QuickAddTaskModal } from "@/components/tasks/QuickAddTaskModal";
import { formatTenge } from "@/lib/format";

const SEVERITY_STYLES: Record<ActionSeverity, { dot: string; label: string }> = {
  critical: { dot: "bg-risk", label: "Срочно" },
  high: { dot: "bg-brass", label: "Важно" },
  medium: { dot: "bg-navy", label: "Плановое" },
};

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

  const queue = useMemo(() => {
    if (!overviews || !taskOverview) return null;
    return getActionQueue(overviews, taskOverview);
  }, [overviews, taskOverview]);

  // Клиенты с активным делом — карточки сортируются так, чтобы те,
  // что требуют внимания, шли первыми.
  const clientCards = useMemo(() => {
    if (!overviews) return [];
    return overviews
      .filter((o) => o.mortgageCase)
      .sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention));
  }, [overviews]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-ink sm:text-[28px]">
            Дашборд
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-soft">
            Текущее состояние клиентов и ипотечных дел.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
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

      {/* Что делать сейчас — единственный вход в работу, ранжированный список */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="font-display text-[17px] font-semibold text-ink">
              Что делать сейчас
            </h2>
            <p className="mt-1 text-[13px] text-ink-soft">
              Собрано по всем клиентам, от самого срочного к плановому.
            </p>
          </div>
          <Link
            href="/tasks"
            className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-navy hover:underline"
          >
            Все задачи
            <ArrowRight size={14} />
          </Link>
        </div>

        {queue === null && <p className="px-6 pb-6 text-sm text-ink-soft">Загрузка…</p>}

        {queue !== null && queue.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 pb-10 pt-2 text-center">
            <CheckCircle2 size={28} className="text-success" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink">Всё под контролем</p>
            <p className="text-[13px] text-ink-soft">Срочных и просроченных задач нет.</p>
          </div>
        )}

        {queue !== null && queue.length > 0 && (
          <ul className="divide-y divide-line">
            {queue.slice(0, 7).map((item) => (
              <ActionQueueRow key={item.id} item={item} />
            ))}
          </ul>
        )}

        {queue !== null && queue.length > 7 && (
          <div className="border-t border-line px-6 py-3">
            <Link href="/tasks" className="text-[13px] font-medium text-navy hover:underline">
              Показать ещё {queue.length - 7}
            </Link>
          </div>
        )}
      </Card>

      {/* Тихая сводка — контекст, а не отдельная задача для просмотра */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Клиенты"
          value={stats?.totalClients ?? "—"}
          icon={<Users size={18} strokeWidth={1.75} />}
          tone="navy"
        />
        <StatCard
          label="Активные дела"
          value={stats?.activeCases ?? "—"}
          icon={<FolderClock size={18} strokeWidth={1.75} />}
          tone="brass"
        />
        <StatCard
          label="Задач сегодня"
          value={taskOverview?.today.length ?? "—"}
          icon={<CalendarCheck size={18} strokeWidth={1.75} />}
          tone="navy"
        />
        <StatCard
          label="Просрочено"
          value={taskOverview?.overdue.length ?? "—"}
          icon={<AlertTriangle size={18} strokeWidth={1.75} />}
          tone="risk"
        />
      </div>

      {/* Клиенты — карточки вместо плотных строк, круговой прогресс вместо линии */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-semibold text-ink">Клиенты</h2>
          <Link href="/clients" className="text-[13px] font-medium text-navy hover:underline">
            Все клиенты
          </Link>
        </div>

        {overviews === null && <p className="text-sm text-ink-soft">Загрузка…</p>}

        {overviews !== null && clientCards.length === 0 && (
          <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="font-medium text-ink">Нет клиентов</p>
            <p className="text-sm text-ink-soft">Добавьте первого клиента, чтобы начать работу.</p>
            <LinkButton href="/clients/new">
              <UserPlus size={16} />
              Добавить клиента
            </LinkButton>
          </Card>
        )}

        {clientCards.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clientCards.slice(0, 9).map((overview) => (
              <ClientCard key={overview.client.id} overview={overview} />
            ))}
          </div>
        )}
      </div>

      {/* Финансы — компактная строка, не соревнуется за внимание с очередью задач */}
      {finance && (
        <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <Wallet size={15} className="text-ink-faint" />
            Финансы по всем делам
          </span>
          <span className="text-[13px] text-ink-soft">
            Начислено{" "}
            <span className="font-data font-semibold text-ink">
              {formatTenge(finance.totalAccrued)}
            </span>
          </span>
          <span className="text-[13px] text-ink-soft">
            Оплачено{" "}
            <span className="font-data font-semibold text-success">
              {formatTenge(finance.totalPaid)}
            </span>
          </span>
          <span className="text-[13px] text-ink-soft">
            Остаток{" "}
            <span className="font-data font-semibold text-brass">
              {formatTenge(finance.remaining)}
            </span>
          </span>
        </Card>
      )}

      {showAddTask && <QuickAddTaskModal onClose={() => setShowAddTask(false)} onCreated={reload} />}
    </div>
  );
}

function ActionQueueRow({ item }: { item: ActionQueueItem }) {
  const style = SEVERITY_STYLES[item.severity];
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-3.5 px-6 py-3.5 transition-colors hover:bg-surface-sunken"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{item.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-ink-soft">{item.clientName}</p>
        </div>
        <span className="shrink-0 text-[13px] text-ink-faint">{item.detail}</span>
        <ArrowRight size={15} className="shrink-0 text-ink-faint" />
      </Link>
    </li>
  );
}

function ClientCard({ overview }: { overview: ClientOverview }) {
  const { client, mortgageCase, needsAttention, overdueTasksCount } = overview;
  if (!mortgageCase) return null;

  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="flex h-full flex-col gap-4 px-5 py-5 transition-shadow hover:shadow-[0_4px_16px_rgba(20,21,43,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink">{client.fullName}</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {CASE_STAGE_LABELS[mortgageCase.stage]}
            </p>
          </div>
          <CircularProgress
            percent={mortgageCase.progressPercent}
            tone={needsAttention ? "risk" : "navy"}
          />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {overdueTasksCount > 0 ? (
            <Badge tone="risk">Просрочено: {overdueTasksCount}</Badge>
          ) : (
            <Badge tone="success">В графике</Badge>
          )}
          {mortgageCase.taskIds.length > 0 && (
            <Badge tone="neutral">Задач: {mortgageCase.taskIds.length}</Badge>
          )}
          {needsAttention && <Badge tone="warn">Требует внимания</Badge>}
        </div>
      </Card>
    </Link>
  );
}
