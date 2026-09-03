import Link from "next/link";
import { Phone } from "lucide-react";
import { MARITAL_STATUS_LABELS } from "@/types/client";
import { CASE_STAGE_LABELS } from "@/types/mortgageCase";
import { formatTenge, getInitials, formatDate } from "@/lib/format";
import { ClientOverview } from "@/lib/aggregations";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CircularProgress } from "@/components/CircularProgress";

// Карточка клиента для списка/директории — тот же визуальный язык, что и
// карточки на Dashboard (круговой прогресс, бейджи), но с чуть большим
// набором полей: суммой ипотеки и датой создания, нужными именно в списке.
export function ClientListCard({ overview }: { overview: ClientOverview }) {
  const { client, mortgageCase, nextActionTask, overdueTasksCount, needsAttention } = overview;

  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="flex h-full flex-col gap-4 px-5 py-5 transition-shadow hover:shadow-[0_4px_16px_rgba(20,21,43,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-soft text-sm font-semibold text-navy">
              {getInitials(client.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">{client.fullName}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-ink-soft">
                <Phone size={12} className="shrink-0" />
                {client.phone}
              </p>
            </div>
          </div>
          {mortgageCase && (
            <CircularProgress
              percent={mortgageCase.progressPercent}
              tone={needsAttention ? "risk" : "navy"}
              size={48}
            />
          )}
        </div>

        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-soft">{MARITAL_STATUS_LABELS[client.maritalStatus]}</span>
          <span className="font-data font-medium text-ink">
            {formatTenge(client.requiredLoanAmount)}
          </span>
        </div>

        <div className="rounded-lg bg-surface-sunken px-3 py-2.5">
          {mortgageCase ? (
            nextActionTask ? (
              <div className="min-w-0">
                <p className="text-[11px] text-ink-faint">Следующее действие</p>
                <p className="truncate text-[13px] font-medium text-ink">{nextActionTask.title}</p>
                {nextActionTask.dueDate && (
                  <p className="mt-0.5 text-[12px] text-ink-faint">
                    до {formatDate(nextActionTask.dueDate)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-warn">Действие не назначено</p>
            )
          ) : (
            <p className="text-[13px] text-ink-faint">Дело ещё не открыто</p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {mortgageCase && <Badge tone="navy">{CASE_STAGE_LABELS[mortgageCase.stage]}</Badge>}
          {overdueTasksCount > 0 && <Badge tone="risk">Просрочено: {overdueTasksCount}</Badge>}
          {needsAttention && <Badge tone="warn">Требует внимания</Badge>}
          <span className="ml-auto text-[12px] text-ink-faint">{formatDate(client.createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
