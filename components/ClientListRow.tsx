import Link from "next/link";
import { ChevronRight, Phone } from "lucide-react";
import { MARITAL_STATUS_LABELS } from "@/types/client";
import { CASE_STAGE_LABELS } from "@/types/mortgageCase";
import { formatTenge, getInitials, formatDate } from "@/lib/format";
import { ClientOverview } from "@/lib/aggregations";
import { Badge } from "./ui/Badge";
import { ProgressBar } from "./ProgressBar";

// ЭТАП 6, п.6.2: полноценная строка списка клиентов — имя, телефон, статус
// дела, этап, следующее действие и его дата, дата создания.
export function ClientListRow({ overview }: { overview: ClientOverview }) {
  const { client, mortgageCase, nextActionTask } = overview;

  return (
    <Link
      href={`/clients/${client.id}`}
      className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-soft font-display text-sm text-navy">
          {getInitials(client.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{client.fullName}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-soft">
            <Phone size={11} className="shrink-0" />
            {client.phone}
            <span className="text-ink-faint"> · {MARITAL_STATUS_LABELS[client.maritalStatus]}</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 sm:w-36">
        <p className="font-data text-sm text-ink">{formatTenge(client.requiredLoanAmount)}</p>
        <p className="text-xs text-ink-faint">сумма ипотеки</p>
      </div>

      <div className="sm:w-44">
        {mortgageCase ? (
          <ProgressBar
            percent={mortgageCase.progressPercent}
            label={CASE_STAGE_LABELS[mortgageCase.stage]}
          />
        ) : (
          <Badge tone="neutral">Без дела</Badge>
        )}
      </div>

      <div className="shrink-0 sm:w-52">
        {mortgageCase ? (
          nextActionTask ? (
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{nextActionTask.title}</p>
              {nextActionTask.dueDate && (
                <p className="mt-0.5 text-xs text-ink-faint">
                  до {formatDate(nextActionTask.dueDate)}
                </p>
              )}
            </div>
          ) : (
            <Badge tone="warn">Нет следующего действия</Badge>
          )
        ) : (
          <span className="text-xs text-ink-faint">—</span>
        )}
      </div>

      <div className="hidden shrink-0 text-xs text-ink-faint sm:block sm:w-24">
        {formatDate(client.createdAt)}
      </div>

      <div className="hidden shrink-0 sm:block">
        {overview.needsAttention ? (
          <Badge tone="risk">Требует внимания</Badge>
        ) : (
          <Badge tone="success">В норме</Badge>
        )}
      </div>

      <ChevronRight size={18} className="hidden shrink-0 text-ink-faint sm:block" />
    </Link>
  );
}
