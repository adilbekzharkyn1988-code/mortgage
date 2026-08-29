/**
 * income.ts — расчёт дохода клиента по выписке о пенсионных отчислениях (ЕНПФ).
 *
 * Правило (обновлено): доход НЕ считается по одному последнему взносу.
 * Берутся ВСЕ отчисления за последний год из выписки, считается их среднее
 * значение, и уже оно умножается на 10 (ОПВ — 10% от официальной зарплаты).
 * Это сглаживает разовые премии/бонусы и просевшие месяцы.
 */

export interface PensionContributionItem {
  period: string | null; // например "Июль 2026"
  amount: number | null;
}

/**
 * Среднее по всем валидным (числовым, положительным) отчислениям.
 * Возвращает null, если посчитать не из чего — вызывающий код должен
 * трактовать это как "доход не подтверждён", а не как 0.
 */
export function averagePensionContribution(
  contributions: PensionContributionItem[] | null | undefined
): number | null {
  if (!contributions || contributions.length === 0) return null;

  const amounts = contributions
    .map((c) => c?.amount)
    .filter((a): a is number => typeof a === "number" && Number.isFinite(a) && a > 0);

  if (amounts.length === 0) return null;

  const sum = amounts.reduce((total, a) => total + a, 0);
  return sum / amounts.length;
}

/**
 * Расчётный ежемесячный доход клиента: среднее отчисление за последний год × 10.
 * Возвращает 0, если данных недостаточно (совместимо с существующей
 * проверкой "computedIncome <= 0" на шаге создания клиента).
 */
export function calculateIncomeFromPensionContributions(
  contributions: PensionContributionItem[] | null | undefined
): number {
  const average = averagePensionContribution(contributions);
  return average !== null ? average * 10 : 0;
}
