import { clientService } from "@/lib/services/clientService";
import { caseService } from "@/lib/services/caseService";
import { taskService } from "@/lib/services/taskService";
import { documentService } from "@/lib/services/documentService";
import { contractService } from "@/lib/services/contractService";
import { paymentService } from "@/lib/services/paymentService";
import { Client } from "@/types/client";
import {
  CASE_STAGE_ORDER,
  CaseStage,
  DossierAnalysis,
  MortgageCase,
} from "@/types/mortgageCase";
import { Task } from "@/types/task";
import { ClientDocument, DocumentType } from "@/types/document";
import { CaseFinanceSummary, Contract } from "@/types/finance";
import { calculateDossierProgress } from "@/lib/progress";
import { calculateFinanceSummary } from "@/lib/finance";

// ==============================================================================
// ЭТАП 6: рабочий кабинет брокера — объединяет данные всех сервисов
// (клиенты, дела, задачи, документы, договоры, платежи) в одну сводку,
// чтобы список клиентов, Dashboard и блоки "Требует внимания" не читали
// localStorage повторно и не дублировали логику соединения сервисов.
// ==============================================================================

export interface ClientOverview {
  client: Client;
  mortgageCase: MortgageCase | null;
  nextActionTask: Task | null;

  // ЭТАП 6:
  contract: Contract | null;
  finance: CaseFinanceSummary;
  overdueTasksCount: number;
  latestAnalysis: DossierAnalysis | null;
  highRiskCount: number;
  missingDocumentTypes: DocumentType[];
  /** Дело есть и ещё не находится на последнем этапе воронки. */
  isActive: boolean;
  /** Есть хотя бы одна причина показать дело в блоке "Требует внимания". */
  needsAttention: boolean;
  /** Человекочитаемые причины — используются в UI (список проблем). */
  attentionReasons: string[];
}

/**
 * Собирает клиентов вместе с их делами, задачами, документами, договором
 * и платежами — один проход по каждому сервису, дальше всё считается в памяти
 * (см. п.6.23 ТЗ — не делать повторные чтения localStorage).
 */
export async function getClientOverviews(): Promise<ClientOverview[]> {
  const [clients, cases, tasks, documents, contracts, payments] = await Promise.all([
    clientService.getAll(),
    caseService.getAll(),
    taskService.getAll(),
    documentService.getAll(),
    contractService.getAll(),
    paymentService.getAll(),
  ]);

  const caseByClientId = new Map(cases.map((c) => [c.clientId, c]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const tasksByCaseId = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = tasksByCaseId.get(task.caseId) ?? [];
    list.push(task);
    tasksByCaseId.set(task.caseId, list);
  }

  const documentsByCaseId = new Map<string, ClientDocument[]>();
  for (const doc of documents) {
    const list = documentsByCaseId.get(doc.caseId) ?? [];
    list.push(doc);
    documentsByCaseId.set(doc.caseId, list);
  }

  const contractsByCaseId = new Map<string, Contract[]>();
  for (const contract of contracts) {
    const list = contractsByCaseId.get(contract.caseId) ?? [];
    list.push(contract);
    contractsByCaseId.set(contract.caseId, list);
  }

  const paymentAmountsByCaseId = new Map<string, number[]>();
  for (const payment of payments) {
    const list = paymentAmountsByCaseId.get(payment.caseId) ?? [];
    list.push(payment.amount);
    paymentAmountsByCaseId.set(payment.caseId, list);
  }

  return clients
    .map((client) => {
      const mortgageCase = caseByClientId.get(client.id) ?? null;
      const nextActionTask = mortgageCase?.nextActionTaskId
        ? (taskById.get(mortgageCase.nextActionTaskId) ?? null)
        : null;

      let contract: Contract | null = null;
      let finance = calculateFinanceSummary(0, []);
      let overdueTasksCount = 0;
      let latestAnalysis: DossierAnalysis | null = null;
      let highRiskCount = 0;
      let missingDocumentTypes: DocumentType[] = [];
      let isActive = false;

      if (mortgageCase) {
        const caseTasks = tasksByCaseId.get(mortgageCase.id) ?? [];
        overdueTasksCount = caseTasks.filter((t) => taskService.isOverdue(t)).length;

        const caseDocuments = documentsByCaseId.get(mortgageCase.id) ?? [];
        missingDocumentTypes = calculateDossierProgress(client, caseDocuments).requiredDocumentTypes;

        const caseContracts = contractsByCaseId.get(mortgageCase.id) ?? [];
        contract = caseContracts[0] ?? null;

        const casePaymentAmounts = paymentAmountsByCaseId.get(mortgageCase.id) ?? [];
        finance = calculateFinanceSummary(
          contract?.totalAmount ?? 0,
          casePaymentAmounts.map((amount) => ({
            id: "",
            caseId: mortgageCase.id,
            amount,
            paymentDate: "",
            paymentMethod: "other" as const,
            createdAt: "",
            updatedAt: "",
          }))
        );

        latestAnalysis = mortgageCase.analyses[mortgageCase.analyses.length - 1] ?? null;
        highRiskCount = latestAnalysis?.risks.filter((r) => r.severity === "high").length ?? 0;

        isActive = mortgageCase.stage !== CASE_STAGE_ORDER[CASE_STAGE_ORDER.length - 1];
      }

      const attentionReasons: string[] = [];
      if (mortgageCase) {
        if (overdueTasksCount > 0) {
          attentionReasons.push(`Просроченные задачи: ${overdueTasksCount}`);
        }
        if (!mortgageCase.nextActionTaskId) {
          attentionReasons.push("Следующее действие не назначено");
        }
        if (mortgageCase.discrepancies.length > 0) {
          attentionReasons.push(`Найдены расхождения: ${mortgageCase.discrepancies.length}`);
        }
        if (highRiskCount > 0) {
          attentionReasons.push(`Высокий риск: ${highRiskCount}`);
        }
        if (missingDocumentTypes.length > 0) {
          attentionReasons.push(`Ожидаются документы: ${missingDocumentTypes.length}`);
        }
        if (finance.remaining > 0 && contract) {
          attentionReasons.push("Неоплаченный остаток");
        }
      }

      return {
        client,
        mortgageCase,
        nextActionTask,
        contract,
        finance,
        overdueTasksCount,
        latestAnalysis,
        highRiskCount,
        missingDocumentTypes,
        isActive,
        needsAttention: attentionReasons.length > 0,
        attentionReasons,
      };
    })
    .sort((a, b) => (a.client.updatedAt < b.client.updatedAt ? 1 : -1));
}

/** Считает дела по этапам воронки — для блока "Воронка ипотеки" на Dashboard. */
export function getFunnelCounts(overviews: ClientOverview[]): Record<CaseStage, number> {
  const counts = Object.fromEntries(CASE_STAGE_ORDER.map((s) => [s, 0])) as Record<
    CaseStage,
    number
  >;
  for (const overview of overviews) {
    if (overview.mortgageCase) {
      counts[overview.mortgageCase.stage] += 1;
    }
  }
  return counts;
}

// ==============================================================================
// ЭТАП 6: сквозной список задач по всем делам — для раздела "Задачи",
// блоков "Сегодня"/"Просрочено" на Dashboard и календаря.
// ==============================================================================

export interface TaskWithContext extends Task {
  clientName: string;
  isOverdue: boolean;
  isToday: boolean;
}

export interface GlobalTaskOverview {
  all: TaskWithContext[];
  today: TaskWithContext[];
  overdue: TaskWithContext[];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getGlobalTaskOverview(): Promise<GlobalTaskOverview> {
  const [clients, tasks] = await Promise.all([clientService.getAll(), taskService.getAll()]);
  const clientNameById = new Map(clients.map((c) => [c.id, c.fullName]));
  const today = todayKey();

  const all: TaskWithContext[] = tasks.map((task) => ({
    ...task,
    clientName: clientNameById.get(task.clientId) ?? "Неизвестный клиент",
    isOverdue: taskService.isOverdue(task),
    isToday: Boolean(task.dueDate) && task.dueDate!.slice(0, 10) === today,
  }));

  return {
    all,
    today: all.filter((t) => t.isToday && t.status !== "done" && t.status !== "cancelled"),
    overdue: all.filter((t) => t.isOverdue),
  };
}

// ЭТАП 5: финансовая сводка для Dashboard — начислено (по всем договорам),
// оплачено (по всем платежам), остаток, и суммы оплат за сегодня/за месяц.
// Т.к. данные пока хранятся в localStorage, это статистика локальных данных CRM.
export interface DashboardFinanceOverview {
  totalAccrued: number;
  totalPaid: number;
  remaining: number;
  paidToday: number;
  paidThisMonth: number;
}

export async function getFinanceOverview(): Promise<DashboardFinanceOverview> {
  const [contracts, payments] = await Promise.all([
    contractService.getAll(),
    paymentService.getAll(),
  ]);

  const totalAccrued = contracts.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const diff = totalAccrued - totalPaid;

  const now = new Date();
  const key = now.toISOString().slice(0, 10);

  const paidToday = payments
    .filter((p) => p.paymentDate.slice(0, 10) === key)
    .reduce((sum, p) => sum + p.amount, 0);

  const paidThisMonth = payments
    .filter((p) => {
      const d = new Date(p.paymentDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    totalAccrued,
    totalPaid,
    remaining: diff > 0 ? diff : 0,
    paidToday,
    paidThisMonth,
  };
}
