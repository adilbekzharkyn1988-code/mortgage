// ЭТАП 5: договоры и платежи по ипотечному делу.
// Договор и платежи принадлежат MortgageCase (caseId), как документы и задачи.

export type ContractStatus = "draft" | "active" | "completed" | "cancelled";

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Черновик",
  active: "Активен",
  completed: "Завершён",
  cancelled: "Отменён",
};

export interface Contract {
  id: string;
  caseId: string;

  contractNumber: string;
  contractDate: string; // ISO date
  serviceName: string;
  totalAmount: number; // стоимость услуг
  currency: string; // напр. "KZT"
  status: ContractStatus;

  // Прикреплённый файл договора. Само содержимое файла не сохраняется
  // между перезагрузками (см. lib/services/documentService.ts — тот же
  // подход, что и для документов клиента, п.15 ТЗ): постоянно хранится
  // только имя файла, что консультанту факт прикрепления виден всегда.
  fileName?: string;

  createdAt: string;
  updatedAt: string;
}

export type NewContractInput = Omit<
  Contract,
  "id" | "createdAt" | "updatedAt" | "status"
> & {
  status?: ContractStatus;
};

export type PaymentMethod = "cash" | "card" | "transfer" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  other: "Другое",
};

export interface Payment {
  id: string;
  caseId: string;

  amount: number;
  paymentDate: string; // ISO date
  paymentMethod: PaymentMethod;
  comment?: string;

  createdAt: string;
  updatedAt: string;
}

export type NewPaymentInput = Omit<Payment, "id" | "createdAt" | "updatedAt">;

// Финансовая сводка по одному делу: стоимость услуг (из договора),
// сумма оплат, остаток и переплата. Остаток никогда не вводится вручную —
// он всегда вычисляется (см. lib/finance.ts).
export interface CaseFinanceSummary {
  totalCost: number;
  totalPaid: number;
  remaining: number;
  overpayment: number;
  isFullyPaid: boolean;
}
