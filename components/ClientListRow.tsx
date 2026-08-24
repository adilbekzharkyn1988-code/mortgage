import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Client, MARITAL_STATUS_LABELS } from "@/types/client";
import { MortgageCase, CASE_STAGE_LABELS } from "@/types/mortgageCase";
import { formatTenge, getInitials } from "@/lib/format";
import { Badge } from "./ui/Badge";
import { ProgressBar } from "./ProgressBar";

export function ClientListRow({
  client,
  mortgageCase,
}: {
  client: Client;
  mortgageCase: MortgageCase | null;
}) {
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
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            {client.city} · {MARITAL_STATUS_LABELS[client.maritalStatus]}
            {client.childrenCount > 0 ? ` · детей: ${client.childrenCount}` : ""}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 sm:w-40">
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

      <div className="hidden shrink-0 sm:block">
        {mortgageCase && mortgageCase.discrepancies.length > 0 ? (
          <Badge tone="risk">Несоответствия</Badge>
        ) : mortgageCase && !mortgageCase.nextActionTaskId ? (
          <Badge tone="warn">Нет действия</Badge>
        ) : (
          <Badge tone="success">В норме</Badge>
        )}
      </div>

      <ChevronRight size={18} className="hidden shrink-0 text-ink-faint sm:block" />
    </Link>
  );
}
