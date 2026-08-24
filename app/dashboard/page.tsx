"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, FolderClock, AlertTriangle, ListChecks } from "lucide-react";
import { getClientOverviews, ClientOverview } from "@/lib/aggregations";
import { CASE_STAGE_LABELS } from "@/types/mortgageCase";
import { StatCard } from "@/components/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { UserPlus } from "lucide-react";

export default function DashboardPage() {
  const [overviews, setOverviews] = useState<ClientOverview[] | null>(null);

  useEffect(() => {
    getClientOverviews().then(setOverviews);
  }, []);

  const stats = useMemo(() => {
    if (!overviews) return null;
    const totalClients = overviews.length;
    const activeCases = overviews.filter(
      (o) => o.mortgageCase && o.mortgageCase.stage !== "submission_preparation"
    ).length;
    const missingNextAction = overviews.filter(
      (o) => o.mortgageCase && !o.mortgageCase.nextActionTaskId
    ).length;
    const totalDiscrepancies = overviews.reduce(
      (sum, o) => sum + (o.mortgageCase?.discrepancies.length ?? 0),
      0
    );
    return { totalClients, activeCases, missingNextAction, totalDiscrepancies };
  }, [overviews]);

  const needsAttention = useMemo(() => {
    if (!overviews) return [];
    return overviews.filter(
      (o) =>
        (o.mortgageCase && !o.mortgageCase.nextActionTaskId) ||
        (o.mortgageCase && o.mortgageCase.discrepancies.length > 0)
    );
  }, [overviews]);

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
        <LinkButton href="/clients/new">
          <UserPlus size={16} />
          Новый клиент
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Всего клиентов"
          value={stats?.totalClients ?? "—"}
          icon={<Users size={20} strokeWidth={1.75} />}
          tone="navy"
        />
        <StatCard
          label="Дел в работе"
          value={stats?.activeCases ?? "—"}
          icon={<FolderClock size={20} strokeWidth={1.75} />}
          tone="brass"
        />
        <StatCard
          label="Без следующего действия"
          value={stats?.missingNextAction ?? "—"}
          icon={<AlertTriangle size={20} strokeWidth={1.75} />}
          tone="risk"
        />
        <StatCard
          label="Обнаружено несоответствий"
          value={stats?.totalDiscrepancies ?? "—"}
          icon={<ListChecks size={20} strokeWidth={1.75} />}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader
          eyebrow="Требует внимания"
          title="Клиенты без следующего действия или с несоответствиями"
        />
        <div className="divide-y divide-line">
          {overviews === null && (
            <p className="px-5 py-6 text-sm text-ink-soft">Загрузка…</p>
          )}
          {overviews !== null && needsAttention.length === 0 && (
            <p className="px-5 py-6 text-sm text-ink-soft">
              Сейчас нет клиентов, требующих немедленного внимания.
            </p>
          )}
          {needsAttention.map(({ client, mortgageCase }) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{client.fullName}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {mortgageCase ? CASE_STAGE_LABELS[mortgageCase.stage] : "Без дела"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {mortgageCase && !mortgageCase.nextActionTaskId && (
                  <Badge tone="warn">Нет следующего действия</Badge>
                )}
                {mortgageCase && mortgageCase.discrepancies.length > 0 && (
                  <Badge tone="risk">
                    Несоответствий: {mortgageCase.discrepancies.length}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader eyebrow="Последние обновления" title="Активные дела" />
        <div className="divide-y divide-line">
          {overviews === null && (
            <p className="px-5 py-6 text-sm text-ink-soft">Загрузка…</p>
          )}
          {overviews?.slice(0, 6).map(({ client, mortgageCase }) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 sm:w-56">
                <p className="truncate font-medium text-ink">{client.fullName}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Обновлено {formatDate(client.updatedAt)}
                </p>
              </div>
              <div className="flex-1 sm:max-w-xs">
                <ProgressBar
                  percent={mortgageCase?.progressPercent ?? 0}
                  label={mortgageCase ? CASE_STAGE_LABELS[mortgageCase.stage] : "Без дела"}
                />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
