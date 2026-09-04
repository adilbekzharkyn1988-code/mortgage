/**
 * affordability.ts — расчёт "свободного" дохода клиента (доход минус расход)
 * для оценки того, какой ежемесячный платёж по ипотеке клиент может себе
 * позволить, и для подбора банковских программ (см. lib/bankMatching.ts).
 *
 * Правила по ТЗ:
 * - Суммарный доход семьи = доход клиента + доход супруга/супруги, но ТОЛЬКО
 *   если клиент в браке (указывается вручную на консультации/после
 *   AI-расчёта по пенсионным отчислениям). Если клиент не в браке, в разводе
 *   или вдовец/вдова — доход супруга в расчёт не идёт.
 * - Расходная часть учитывает иждивенцев: детей клиента — всегда, и
 *   супруга/супругу — если он(а) не работает (доход супруга = 0 при браке)
 *   либо если клиент в разводе.
 */

import { Client } from "@/types/client";

// Ориентировочный прожиточный минимум на одного человека, ₸/мес — используется
// только как приближённая оценка базовых расходов на содержание клиента и его
// иждивенцев. Это НЕ официальный показатель, а настраиваемое допущение —
// при необходимости скорректируйте константу под актуальные данные.
export const SUBSISTENCE_MIN_KZT = 46000;

// Не рекомендуем, чтобы весь суммарный ежемесячный платёж (текущие кредиты +
// новая ипотека) превышал эту долю дохода семьи — типичный ориентир банков.
export const MAX_RECOMMENDED_DEBT_RATIO = 0.5;

export interface AffordabilitySummary {
  householdIncome: number; // доход клиента + доход супруга
  isSpouseDependent: boolean; // супруг(а) учтён как иждивенец
  dependentsCount: number; // дети + супруг(а) (если применимо)
  livingCost: number; // оценка расходов на содержание клиента и иждивенцев
  existingDebtPayments: number; // текущие ежемесячные платежи по кредитам
  disposableIncome: number; // доход - расходы на иждивенцев - текущие платежи
  maxRecommendedPayment: number; // рекомендуемый максимум платежа по НОВОЙ ипотеке
}

/**
 * Считает располагаемый доход клиента с учётом состава семьи.
 * Ничего не выдумывает сверх переданных данных клиента — только применяет
 * формулу к уже известным полям (доходы, дети, семейное положение, кредиты).
 */
export function calculateAffordability(client: Client): AffordabilitySummary {
  // Доход супруга учитывается ТОЛЬКО в браке. Если клиент не женат/не
  // замужем, в разводе или вдовец/вдова — доход супруга к делу не относится
  // вообще (даже если в карточке клиента почему-то указано ненулевое
  // значение) и в общий доход семьи не включается.
  const spouseIncomeCounted =
    client.maritalStatus === "married" ? Math.max(client.spouseIncome, 0) : 0;
  const householdIncome = Math.max(client.estimatedIncome, 0) + spouseIncomeCounted;

  // Супруг(а) считается иждивенцем, если в браке, но без собственного дохода,
  // либо если клиент в разводе (по условиям расчёта, заданным консультантом).
  const isSpouseDependent =
    (client.maritalStatus === "married" && client.spouseIncome <= 0) ||
    client.maritalStatus === "divorced";

  const dependentsCount = client.childrenCount + (isSpouseDependent ? 1 : 0);

  // +1 — сам клиент.
  const livingCost = SUBSISTENCE_MIN_KZT * (1 + dependentsCount);

  const existingDebtPayments = Math.max(client.estimatedMonthlyPayments, 0);

  const disposableIncome = Math.max(
    householdIncome - livingCost - existingDebtPayments,
    0
  );

  const debtCeiling = Math.max(
    householdIncome * MAX_RECOMMENDED_DEBT_RATIO - existingDebtPayments,
    0
  );

  const maxRecommendedPayment = Math.min(disposableIncome, debtCeiling);

  return {
    householdIncome,
    isSpouseDependent,
    dependentsCount,
    livingCost,
    existingDebtPayments,
    disposableIncome,
    maxRecommendedPayment,
  };
}
