"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Phone, MapPin, ListPlus } from "lucide-react";
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
import { Tabs } from "@/components/ui/Tabs";
import { CircularProgress } from "@/components/CircularProgress";
import { CaseStageStepper } from "@/components/CaseStageStepper";
import { DocumentsSection } from "@/components/documents/DocumentsSection";
import { DossierPanel } from "@/components/documents/DossierPanel";
import { NextActionBlock } from "@/components/tasks/NextActionBlock";
import { ActionPlanPanel } from "@/components/tasks/ActionPlanPanel";
import { ContractPanel } from "@/components/finance/ContractPanel";
import { FinancePanel } from "@/components/finance/FinancePanel";
import { Contract } from "@/types/finance";
import { ExistingLoansPanel } from "@/components/ExistingLoansPanel";
import { ProgramMatchPanel } from "@/components/programs/ProgramMatchPanel";
import { formatDate, formatTenge, calculateAge, getInitials } from "@/lib/format";

type TabId = "overview" | "documents" | "finance" | "tasks";
const DEFAULT_TAB: TabId = "overview";
const VALID_TABS: TabId[] = ["overview", "documents", "finance", "tasks"];

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab: TabId = useMemo(() => {
    const requested = searchParams.get("tab");
    return VALID_TABS.includes(requested as TabId) ? (requested as TabId) : DEFAULT_TAB;
  }, [searchParams]);

  const setActiveTab = useCallback(
    (tab: string) => {
      router.push(`/clients/${id}?tab=${tab}`, { scroll: false });
    },
    [router, id]
  );

  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [mortgageCase, setMortgageCase] = useState<MortgageCase | null>(null);
  const [nextActionTask, setNextActionTask] = useState<Task | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [contract, setContract] = useState<Contract | null>(null);
  const [overdueTasksCount, setOverdueTasksCount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
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
      const freshCase = await caseService.getById(mortgageCase.id);
      if (!freshCase) return;
      setMortgageCase(freshCase);
    },
    [client, mortgageCase]
  );

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
  const latestAnalysis = mortgageCase?.analyses[mortgageCase.analyses.length - 1] ?? null;
  const highRiskCount = latestAnalysis?.risks.filter((r) => r.severity === "high").length ?? 0;
  const remaining = Math.max((contract?.totalAmount ?? 0) - totalPaid, 0);

  type Chip = { id: string; label: string; tone: "risk" | "warn"; tab: TabId };
  const chips: Chip[] = [];
  if (mortgageCase) {
    if (overdueTasksCount > 0) {
      chips.push({ id: "overdue", label: `Просрочено: ${overdueTasksCount}`, tone: "risk", tab: "tasks" });
    }
    if (mortgageCase.discrepancies.length > 0) {
      chips.push({
        id: "discrepancies",
        label: `Расхождения: ${mortgageCase.discrepancies.length}`,
        tone: "warn",
        tab: "documents",
      });
    }
    if (highRiskCount > 0) {
      chips.push({ id: "risk", label: `Высокий риск: ${highRiskCount}`, tone: "risk", tab: "documents" });
    }
    if (contract && remaining > 0) {
      chips.push({
        id: "unpaid",
        label: `Не оплачено: ${formatTenge(remaining)}`,
        tone: "warn",
        tab: "finance",
      });
    }
  }

  const tabs = [
    { id: "overview", label: "Обзор" },
    { id: "documents", label: "Документы и ИИ", count: mortgageCase?.discrepancies.length },
    { id: "finance", label: "Финансы" },
    { id: "tasks", label: "Задачи", count: overdueTasksCount },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/clients"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={15} />
        Все клиенты
      </Link>

      {/* Заголовок клиента */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy-soft text-lg font-semibold text-navy">
            {getInitials(client.fullName)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[22px] font-semibold text-ink sm:text-[26px]">
                {client.fullName}
              </h1>
              {mortgageCase ? (
                <Badge tone="navy">{CASE_STAGE_LABELS[mortgageCase.stage]}</Badge>
              ) : (
                <Badge tone="neutral">Без дела</Badge>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <Phone size={13} />
                {client.phone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} />
                {client.city}
              </span>
              {age !== null && <span>{age} лет</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Ассистент дела — единственный блок наверху, отвечающий на вопрос
          "что происходит с делом и что делать дальше", вместо разбросанных
          карточек "Требует внимания" / "Ипотечное дело" / баннера. */}
      {mortgageCase ? (
        <Card className="px-6 py-6">
          <div className="flex flex-col gap-6">
            <CaseStageStepper stage={mortgageCase.stage} />

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <CircularProgress
                  percent={mortgageCase.progressPercent}
                  tone={chips.length > 0 ? "risk" : "navy"}
                  size={64}
                />
                <div>
                  <p className="text-[13px] text-ink-soft">Прогресс дела</p>
                  <p className="text-[13px] text-ink-soft">
                    {mortgageCase.documentIds.length} документов · {mortgageCase.taskIds.length} задач
                  </p>
                </div>
              </div>

              <div className="h-px flex-1 sm:h-10 sm:w-px sm:flex-none bg-line" />

              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-ink-soft">Следующее действие</p>
                {nextActionTask ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-medium text-ink">{nextActionTask.title}</p>
                    {nextActionTask.dueDate && (
                      <span className="text-[13px] text-ink-faint">
                        до {formatDate(nextActionTask.dueDate)}
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveTab("tasks")}
                    className="mt-1 flex items-center gap-1.5 text-[15px] font-medium text-navy hover:underline"
                  >
                    <ListPlus size={15} />
                    Назначить следующее действие
                  </button>
                )}
              </div>

              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <button key={chip.id} onClick={() => setActiveTab(chip.tab)}>
                      <Badge tone={chip.tone}>{chip.label}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="px-6 py-6">
          <p className="text-sm text-ink-soft">Для этого клиента не найдено ипотечное дело.</p>
        </Card>
      )}

      {/* Вкладки — вместо длинной ленты карточек одну за другой */}
      <div>
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        <div className="pt-6">
          {activeTab === "overview" && (
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader title="Личные данные" />
                <div className="grid grid-cols-2 gap-5 px-6 pb-6 sm:grid-cols-3 lg:grid-cols-4">
                  <DetailField label="ФИО" value={client.fullName} />
                  <DetailField label="Телефон" value={client.phone} />
                  <DetailField label="Дата рождения" value={formatDate(client.birthDate)} />
                  <DetailField label="Город" value={client.city} />
                  <DetailField
                    label="Семейное положение"
                    value={MARITAL_STATUS_LABELS[client.maritalStatus]}
                  />
                  <DetailField label="Количество детей" value={client.childrenCount} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Доход и параметры сделки" />
                <div className="grid grid-cols-2 gap-5 px-6 pb-6 sm:grid-cols-3 lg:grid-cols-4">
                  <DetailField label="Доход клиента" value={formatTenge(client.estimatedIncome)} />
                  <DetailField label="Доход супруга/супруги" value={formatTenge(client.spouseIncome)} />
                  <DetailField label="Суммарный доход" value={formatTenge(totalIncome)} />
                  <DetailField label="Стоимость недвижимости" value={formatTenge(client.propertyValue)} />
                  <DetailField label="Первоначальный взнос" value={formatTenge(client.downPayment)} />
                  <DetailField
                    label="Необходимая сумма ипотеки"
                    value={formatTenge(client.requiredLoanAmount)}
                  />
                </div>
              </Card>

              <ExistingLoansPanel client={client} onClientChange={setClient} />
              <ProgramMatchPanel client={client} />
            </div>
          )}

          {activeTab === "documents" && mortgageCase && (
            <div className="flex flex-col gap-6">
              {mortgageCase.discrepancies.length > 0 && (
                <Card>
                  <CardHeader title="Обнаруженные несоответствия" />
                  <div className="flex flex-col gap-3 px-6 pb-6">
                    {mortgageCase.discrepancies.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-xl border border-risk/15 bg-risk-soft px-4 py-3 text-sm"
                      >
                        <p className="font-medium text-risk">{d.field}</p>
                        <p className="mt-1 text-ink-soft">
                          {d.sourceA}: <span className="font-data text-ink">{d.valueA}</span>
                          {"  ·  "}
                          {d.sourceB}: <span className="font-data text-ink">{d.valueB}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div>
                <p className="mb-3 text-[13px] text-ink-soft">
                  ИИ читает загруженные документы и сам извлекает из них данные — доход, состав
                  семьи, кредиты — без ручного ввода.
                </p>
                <DocumentsSection
                  client={client}
                  caseId={mortgageCase.id}
                  onDocumentsChange={handleDocumentsChange}
                  onClientChange={setClient}
                  onTaskCreated={handleTaskChange}
                />
              </div>

              <div>
                <p className="mb-3 text-[13px] text-ink-soft">
                  Сводный анализ дела: что подтверждено, чего не хватает и какие риски видит ИИ — с
                  готовыми задачами для плана действий.
                </p>
                <DossierPanel
                  client={client}
                  documents={documents}
                  caseId={mortgageCase.id}
                  onTaskCreated={handleTaskChange}
                />
              </div>
            </div>
          )}

          {activeTab === "finance" && mortgageCase && (
            <div className="flex flex-col gap-6">
              <ContractPanel caseId={mortgageCase.id} onContractChange={setContract} />
              <FinancePanel caseId={mortgageCase.id} totalCost={contract?.totalAmount ?? 0} />
            </div>
          )}

          {activeTab === "tasks" && mortgageCase && (
            <div key={taskRefreshKey} className="flex flex-col gap-6">
              <NextActionBlock caseId={mortgageCase.id} />
              <ActionPlanPanel caseId={mortgageCase.id} onTaskUpdate={handleTaskChange} />
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-faint">Клиент создан {formatDate(client.createdAt)}.</p>
    </div>
  );
}
