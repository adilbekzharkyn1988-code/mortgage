"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, MapPin, AlertTriangle, FileText, ListChecks } from "lucide-react";
import { clientService } from "@/lib/services/clientService";
import { caseService } from "@/lib/services/caseService";
import { taskService } from "@/lib/services/taskService";
import { paymentService } from "@/lib/services/paymentService";
import { Client, MARITAL_STATUS_LABELS } from "@/types/client";
import { CASE_STAGE_LABELS, MortgageCase } from "@/types/mortgageCase";
import { Task } from "@/types/task";
import { ClientDocument } from "@/types/document";
import { Card, CardHeader } from "@/components/ui/Card";
import { DetailField } from "@/components/ui/DetailField";
import { Badge } from "@/components/ui/Badge";
import { CaseStageStepper } from "@/components/CaseStageStepper";
import { NextActionBanner } from "@/components/NextActionBanner";
import { DocumentsSection } from "@/components/documents/DocumentsSection";
import { DossierPanel } from "@/components/documents/DossierPanel";
import { NextActionBlock } from "@/components/tasks/NextActionBlock";
import { ActionPlanPanel } from "@/components/tasks/ActionPlanPanel";
import { ContractPanel } from "@/components/finance/ContractPanel";
import { FinancePanel } from "@/components/finance/FinancePanel";
import { Contract } from "@/types/finance";
import { AttentionItem, AttentionList } from "@/components/AttentionList";
import { ExistingLoansPanel } from "@/components/ExistingLoansPanel";
import { calculateDossierProgress } from "@/lib/progress";
import { formatDate, formatTenge, calculateAge, getInitials } from "@/lib/format";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [mortgageCase, setMortgageCase] = useState<MortgageCase | null>(null);
  const [nextActionTask, setNextActionTask] = useState<Task | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  // ЭТАП 5: договор дела — нужен здесь, чтобы передать стоимость услуг
  // в финансовый блок (FinancePanel), где вычисляется остаток.
  const [contract, setContract] = useState<Contract | null>(null);
  // ЭТАП 6, п.6.8: для блока "Требует внимания" нужно количество просроченных
  // задач и оплаченный остаток дела — оба считаются по существующим сервисам.
  const [overdueTasksCount, setOverdueTasksCount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  // ЭТАП 4: счётчик, увеличивающийся при любом изменении задач — используется
  // ниже, чтобы принудительно обновить NextActionBanner и блок "Требует внимания".
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const foundClient = await clientService.getById(id);
      if (cancelled) return;
      setClient(foundClient);

      if (foundClient) {
        const foundCase = await caseService.getByClientId(foundClient.id);
        if (cancelled) return;
        setMortgageCase(foundCase);

        if (foundCase?.nextActionTaskId) {
          const task = await taskService.getById(foundCase.nextActionTaskId);
          if (!cancelled) setNextActionTask(task);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ЭТАП 6, п.6.8: пересчитываем данные для блока "Требует внимания"
  // при смене дела или после изменения задач/оплат.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!mortgageCase) {
        if (!cancelled) setOverdueTasksCount(0);
        return;
      }
      const [tasks, paid] = await Promise.all([
        taskService.getByCaseId(mortgageCase.id),
        paymentService.getTotalPaid(mortgageCase.id),
      ]);
      if (cancelled) return;
      setOverdueTasksCount(tasks.filter((t) => taskService.isOverdue(t)).length);
      setTotalPaid(paid);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mortgageCase?.id, taskRefreshKey]);

  const handleDocumentsChange = useCallback(
    async (docs: ClientDocument[]) => {
      setDocuments(docs);
      if (!client || !mortgageCase) return;

      // Документы могли добавить новые несоответствия (см. lib/matching.ts) —
      // подтягиваем актуальное дело, а не только пересчитываем прогресс.
      const freshCase = await caseService.getById(mortgageCase.id);
      if (!freshCase) return;

      const progress = calculateDossierProgress(client, docs);
      if (progress.overall !== freshCase.progressPercent) {
        const updated = await caseService.update(freshCase.id, {
          progressPercent: progress.overall,
        });
        setMortgageCase(updated ?? freshCase);
      } else {
        setMortgageCase(freshCase);
      }
    },
    [client, mortgageCase]
  );

  // ЭТАП 4: план действий/задачи меняются внутри дочерних панелей — после
  // любого изменения задачи подтягиваем актуальное "следующее действие" для
  // существующего NextActionBanner (закреплённая задача дела).
  const handleTaskChange = useCallback(async () => {
    setTaskRefreshKey((k) => k + 1);
    if (!mortgageCase) return;
    const freshCase = await caseService.getById(mortgageCase.id);
    if (freshCase) {
      setMortgageCase(freshCase);
      if (freshCase.nextActionTaskId) {
        const task = await taskService.getById(freshCase.nextActionTaskId);
        setNextActionTask(task);
      } else {
        setNextActionTask(null);
      }
    }
  }, [mortgageCase]);

  if (client === undefined) {
    return <p className="text-sm text-ink-soft">Загрузка…</p>;
  }

  if (client === null) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-ink-soft">Клиент не найден.</p>
        <Link href="/clients" className="text-sm font-medium text-navy hover:underline">
          ← Вернуться к списку клиентов
        </Link>
      </div>
    );
  }

  const age = calculateAge(client.birthDate);
  const totalIncome = client.estimatedIncome + client.spouseIncome;

  // ЭТАП 6, п.6.8: блок "Требует внимания" для этого конкретного дела —
  // собирается из уже загруженных данных страницы (без новых сервисов).
  const dossierProgress = mortgageCase ? calculateDossierProgress(client, documents) : null;
  const latestAnalysis = mortgageCase?.analyses[mortgageCase.analyses.length - 1] ?? null;
  const highRiskCount = latestAnalysis?.risks.filter((r) => r.severity === "high").length ?? 0;
  const remaining = Math.max((contract?.totalAmount ?? 0) - totalPaid, 0);

  const attentionItems: AttentionItem[] = [];
  if (mortgageCase) {
    if (overdueTasksCount > 0) {
      attentionItems.push({
        id: "overdue",
        label: `Просроченные задачи: ${overdueTasksCount}`,
        href: "#action-plan",
      });
    }
    if (!mortgageCase.nextActionTaskId) {
      attentionItems.push({
        id: "next-action",
        label: "Следующее действие не назначено",
        href: "#action-plan",
      });
    }
    if (mortgageCase.discrepancies.length > 0) {
      attentionItems.push({
        id: "discrepancies",
        label: `Найдены расхождения: ${mortgageCase.discrepancies.length}`,
        href: "#discrepancies",
      });
    }
    if (highRiskCount > 0) {
      attentionItems.push({
        id: "risk",
        label: `Высокий риск: ${highRiskCount}`,
        href: "#dossier",
      });
    }
    if (dossierProgress && dossierProgress.requiredDocumentTypes.length > 0) {
      attentionItems.push({
        id: "documents",
        label: `Ожидаются документы: ${dossierProgress.requiredDocumentTypes.length}`,
        href: "#documents",
      });
    }
    if (contract && remaining > 0) {
      attentionItems.push({
        id: "unpaid",
        label: `Неоплаченный остаток: ${formatTenge(remaining)}`,
        href: "#finance",
      });
    }
  }
  const needsAttention = attentionItems.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/clients"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={15} />
        Все клиенты
      </Link>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy-soft font-display text-xl text-navy">
            {getInitials(client.fullName)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl text-ink sm:text-3xl">{client.fullName}</h1>
              {mortgageCase ? (
                <Badge tone="navy">{CASE_STAGE_LABELS[mortgageCase.stage]}</Badge>
              ) : (
                <Badge tone="neutral">Без дела</Badge>
              )}
              {mortgageCase &&
                (needsAttention ? (
                  <Badge tone="risk">Требует внимания</Badge>
                ) : (
                  <Badge tone="success">В норме</Badge>
                ))}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <Phone size={14} />
                {client.phone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} />
                {client.city}
              </span>
              {age !== null && <span>{age} лет</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ЭТАП 6, п.6.8: требует внимания — по этому конкретному делу */}
      {mortgageCase && (
        <Card>
          <CardHeader eyebrow="Ипотечное дело" title="Требует внимания" />
          <div className="p-5">
            <AttentionList items={attentionItems} emptyMessage="По этому делу открытых проблем нет." />
          </div>
        </Card>
      )}

      {/* Ипотечное дело: этап, прогресс, следующее действие */}
      <Card>
        <CardHeader
          eyebrow="Ипотечное дело"
          title={mortgageCase ? `Дело №${mortgageCase.id}` : "Дело не найдено"}
        />
        <div className="flex flex-col gap-5 p-5">
          {mortgageCase ? (
            <>
              <CaseStageStepper stage={mortgageCase.stage} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3">
                  <p className="text-xs text-ink-faint">Прогресс дела</p>
                  <p className="mt-1 font-data text-xl text-ink">
                    {mortgageCase.progressPercent}%
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-ink-faint">
                    <FileText size={13} /> Документов загружено
                  </p>
                  <p className="font-data text-xl text-ink">{mortgageCase.documentIds.length}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-ink-faint">
                    <ListChecks size={13} /> Задач в плане
                  </p>
                  <p className="font-data text-xl text-ink">{mortgageCase.taskIds.length}</p>
                </div>
              </div>
              <NextActionBanner task={nextActionTask} />
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              Для этого клиента не найдено ипотечное дело.
            </p>
          )}
        </div>
      </Card>

      {/* ЭТАП 5: договор и финансы дела */}
      {mortgageCase && (
        <div id="finance" className="flex flex-col gap-6">
          <ContractPanel caseId={mortgageCase.id} onContractChange={setContract} />
          <FinancePanel caseId={mortgageCase.id} totalCost={contract?.totalAmount ?? 0} />
        </div>
      )}

      {/* Несоответствия */}
      {mortgageCase && mortgageCase.discrepancies.length > 0 && (
        <Card id="discrepancies">
          <CardHeader eyebrow="Проверка данных" title="Обнаруженные несоответствия" />
          <div className="flex flex-col gap-3 p-5">
            {mortgageCase.discrepancies.map((d) => (
              <div
                key={d.id}
                className="flex items-start gap-3 rounded-lg border border-risk/20 bg-risk-soft px-4 py-3 text-sm"
              >
                <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-risk" />
                <div>
                  <p className="font-medium text-risk">Обнаружено расхождение: {d.field}</p>
                  <p className="mt-1 text-ink-soft">
                    {d.sourceA}: <span className="font-data text-ink">{d.valueA}</span>
                    {"  ·  "}
                    {d.sourceB}: <span className="font-data text-ink">{d.valueB}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">Обнаружено {formatDate(d.detectedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Личные данные */}
      <Card>
        <CardHeader eyebrow="Карточка клиента" title="Личные данные" />
        <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-4">
          <DetailField label="ФИО" value={client.fullName} />
          <DetailField label="Телефон" value={client.phone} />
          <DetailField label="Дата рождения" value={formatDate(client.birthDate)} />
          <DetailField label="Город" value={client.city} />
          <DetailField label="Семейное положение" value={MARITAL_STATUS_LABELS[client.maritalStatus]} />
          <DetailField label="Количество детей" value={client.childrenCount} />
        </div>
      </Card>

      {/* Доход */}
      <Card>
        <CardHeader eyebrow="Карточка клиента" title="Доход" />
        <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-4">
          <DetailField label="Доход клиента" value={formatTenge(client.estimatedIncome)} />
          <DetailField label="Доход супруга/супруги" value={formatTenge(client.spouseIncome)} />
          <DetailField label="Суммарный доход" value={formatTenge(totalIncome)} />
        </div>
      </Card>

      {/* Параметры сделки */}
      <Card>
        <CardHeader eyebrow="Карточка клиента" title="Параметры сделки" />
        <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-4">
          <DetailField label="Стоимость недвижимости" value={formatTenge(client.propertyValue)} />
          <DetailField label="Первоначальный взнос" value={formatTenge(client.downPayment)} />
          <DetailField label="Необходимая сумма ипотеки" value={formatTenge(client.requiredLoanAmount)} />
        </div>
      </Card>

      {/* Текущие кредиты — ручной fallback + автозаполнение из PDF кредитной истории */}
      <ExistingLoansPanel client={client} onClientChange={setClient} />

      {/* Документы + AI-анализ */}
      {mortgageCase && (
        <div id="documents">
          <DocumentsSection
            client={client}
            caseId={mortgageCase.id}
            onDocumentsChange={handleDocumentsChange}
            onClientChange={setClient}
          />
        </div>
      )}

      {/* Досье клиента: сводные подтверждённые данные + прогресс по категориям + AI-анализ */}
      {mortgageCase && (
        <div id="dossier">
          <DossierPanel
            client={client}
            documents={documents}
            caseId={mortgageCase.id}
            onTaskCreated={handleTaskChange}
          />
        </div>
      )}

      {/* ЭТАП 4: план действий — умный расчёт следующего действия по задачам
          и полный список задач с фильтрами, статусами и приоритетами. */}
      {mortgageCase && (
        <div id="action-plan" key={taskRefreshKey} className="flex flex-col gap-6">
          <NextActionBlock caseId={mortgageCase.id} />
          <ActionPlanPanel caseId={mortgageCase.id} onTaskUpdate={handleTaskChange} />
        </div>
      )}

      <p className="text-xs text-ink-faint">Клиент создан {formatDate(client.createdAt)}.</p>
    </div>
  );
}
