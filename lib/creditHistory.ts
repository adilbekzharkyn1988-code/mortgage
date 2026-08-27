// Сопоставляет кредитные линии, извлечённые AI из кредитной истории
// (CreditLineItem, см. types/document.ts), с текущими кредитами клиента
// (ExistingLoan, см. types/client.ts) — чтобы консультанту не нужно было
// вручную перепечатывать каждый кредит после загрузки кредитной истории.

import { ExistingLoan } from "@/types/client";
import { CreditLineItem } from "@/types/document";

function generateLoanId(): string {
  return `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function creditTitle(item: CreditLineItem): string {
  const parts = [item.creditor, item.type].filter(
    (v): v is string => Boolean(v && v.trim().length > 0)
  );
  return parts.length > 0 ? parts.join(" — ") : "Кредит (из кредитной истории)";
}

/**
 * Превращает кредитные линии из документа в формат "текущих кредитов" клиента.
 * Платёж и остаток берутся как есть из документа; если поле не найдено —
 * платёж считается 0 (а не выдумывается), остаток остаётся не указан.
 */
export function mapCreditsToExistingLoans(credits: CreditLineItem[]): ExistingLoan[] {
  return credits.map((item) => ({
    id: generateLoanId(),
    title: creditTitle(item),
    monthlyPayment: item.monthlyPayment ?? 0,
    remainingAmount: item.remainingBalance ?? undefined,
  }));
}

export function sumMonthlyPayments(loans: ExistingLoan[]): number {
  return loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
}
