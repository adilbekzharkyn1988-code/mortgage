// ЭТАП 5: расчёт финансовой сводки по делу.
// Остаток НИКОГДА не вводится вручную — он всегда вычисляется отсюда.

import { CaseFinanceSummary, Payment } from "@/types/finance";

/**
 * @param totalCost стоимость услуг (берётся из договора; 0, если договора нет)
 * @param payments все платежи по делу
 */
export function calculateFinanceSummary(
  totalCost: number,
  payments: Payment[]
): CaseFinanceSummary {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const diff = totalCost - totalPaid;

  return {
    totalCost,
    totalPaid,
    // Остаток никогда не уходит в минус — при переплате он равен 0.
    remaining: diff > 0 ? diff : 0,
    // Переплата показывается отдельно, а не как отрицательный остаток.
    overpayment: diff < 0 ? Math.abs(diff) : 0,
    isFullyPaid: totalCost > 0 && totalPaid >= totalCost,
  };
}
