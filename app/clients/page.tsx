"use client";

// ЭТАП 6, п.6.2–6.6: полноценный список клиентов — поиск, фильтры,
// сортировка и быстрые фильтры поверх существующей агрегации клиентов.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, UserPlus, SlidersHorizontal } from "lucide-react";
import { getClientOverviews, ClientOverview } from "@/lib/aggregations";
import { CaseStage, CASE_STAGE_LABELS, CASE_STAGE_ORDER } from "@/types/mortgageCase";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { TextInput, SelectInput } from "@/components/ui/FormField";
import { ClientListRow } from "@/components/ClientListRow";

type QuickFilter = "all" | "active" | "completed" | "overdue" | "needs_attention" | "awaiting_documents";

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "active", label: "Активные" },
  { value: "completed", label: "Завершённые" },
  { value: "overdue", label: "Просроченные" },
  { value: "needs_attention", label: "Требуют действия" },
  { value: "awaiting_documents", label: "Ожидают документы" },
];

type SortBy = "updated" | "created" | "name" | "nextAction" | "stage";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "updated", label: "По последнему обновлению" },
  { value: "created", label: "По дате создания" },
  { value: "name", label: "По имени" },
  { value: "nextAction", label: "По сроку следующей задачи" },
  { value: "stage", label: "По статусу" },
];

function matchesQuickFilter(overview: ClientOverview, filter: QuickFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return overview.isActive;
    case "completed":
      return Boolean(overview.mortgageCase) && !overview.isActive;
    case "overdue":
      return overview.overdueTasksCount > 0;
    case "needs_attention":
      return overview.needsAttention;
    case "awaiting_documents":
      return overview.missingDocumentTypes.length > 0;
  }
}

function ClientsPageContent() {
  const searchParams = useSearchParams();

  const [overviews, setOverviews] = useState<ClientOverview[] | null>(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<CaseStage | "all">(
    (searchParams.get("stage") as CaseStage) || "all"
  );
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(
    (searchParams.get("quick") as QuickFilter) || "all"
  );
  const [sortBy, setSortBy] = useState<SortBy>("updated");

  useEffect(() => {
    getClientOverviews().then(setOverviews);
  }, []);

  const filtered = useMemo(() => {
    if (!overviews) return [];
    const q = query.trim().toLowerCase();

    let result = overviews.filter(({ client }) => {
      if (!q) return true;
      return (
        client.fullName.toLowerCase().includes(q) ||
        client.city.toLowerCase().includes(q) ||
        client.phone.toLowerCase().includes(q)
      );
    });

    if (stageFilter !== "all") {
      result = result.filter((o) => o.mortgageCase?.stage === stageFilter);
    }

    result = result.filter((o) => matchesQuickFilter(o, quickFilter));

    const sorted = [...result].sort((a, b) => {
      switch (sortBy) {
        case "created":
          return a.client.createdAt < b.client.createdAt ? 1 : -1;
        case "name":
          return a.client.fullName.localeCompare(b.client.fullName, "ru");
        case "nextAction": {
          const da = a.nextActionTask?.dueDate;
          const db = b.nextActionTask?.dueDate;
          if (da && db) return da < db ? -1 : da > db ? 1 : 0;
          if (da) return -1;
          if (db) return 1;
          return 0;
        }
        case "stage": {
          const ia = a.mortgageCase ? CASE_STAGE_ORDER.indexOf(a.mortgageCase.stage) : -1;
          const ib = b.mortgageCase ? CASE_STAGE_ORDER.indexOf(b.mortgageCase.stage) : -1;
          return ia - ib;
        }
        case "updated":
        default:
          // По умолчанию — сначала клиенты, которым требуется действие (п.6.5 ТЗ).
          if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
          return a.client.updatedAt < b.client.updatedAt ? 1 : -1;
      }
    });

    return sorted;
  }, [overviews, query, stageFilter, quickFilter, sortBy]);

  const quickCounts = useMemo(() => {
    if (!overviews) return null;
    return Object.fromEntries(
      QUICK_FILTERS.map(({ value }) => [value, overviews.filter((o) => matchesQuickFilter(o, value)).length])
    ) as Record<QuickFilter, number>;
  }, [overviews]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            База клиентов
          </p>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">Клиенты</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {overviews ? `Найдено: ${filtered.length} из ${overviews.length}` : "Загрузка…"}
          </p>
        </div>
        <LinkButton href="/clients/new">
          <UserPlus size={16} />
          Новый клиент
        </LinkButton>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, городу, телефону"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setQuickFilter(value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                quickFilter === value
                  ? "border-navy bg-navy text-white"
                  : "border-line-strong bg-surface text-ink-soft hover:border-navy/40"
              }`}
            >
              {label}
              {quickCounts && `: ${quickCounts[value]}`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-ink-faint" />
            <SelectInput
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as CaseStage | "all")}
              className="w-auto"
            >
              <option value="all">Все статусы дела</option>
              {CASE_STAGE_ORDER.map((stage) => (
                <option key={stage} value={stage}>
                  {CASE_STAGE_LABELS[stage]}
                </option>
              ))}
            </SelectInput>
          </div>

          <SelectInput
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="w-auto"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </SelectInput>
        </div>
      </div>

      <Card>
        <div className="divide-y divide-line">
          {overviews === null && (
            <p className="px-5 py-8 text-center text-sm text-ink-soft">Загрузка…</p>
          )}
          {overviews !== null && overviews.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
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
          {overviews !== null && overviews.length > 0 && filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-soft">
              Ничего не найдено по заданным условиям.
            </p>
          )}
          {filtered.map((overview) => (
            <ClientListRow key={overview.client.id} overview={overview} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<p className="px-5 py-8 text-center text-sm text-ink-soft">Загрузка…</p>}>
      <ClientsPageContent />
    </Suspense>
  );
}
