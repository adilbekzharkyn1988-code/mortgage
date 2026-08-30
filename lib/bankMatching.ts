/**
 * bankMatching.ts — детерминированный (без AI) подбор банковских программ
 * под конкретного клиента: сравнивает численные критерии программы
 * (types/bank.ts) с данными клиента и располагаемым доходом
 * (lib/affordability.ts). Результат (eligible/ineligible + причины) идёт в
 * общий AI-анализ досье (lib/ai/caseAnalysis.ts), который уже объясняет и
 * даёт план действий — отдельного узкого AI-вызова только под программы
 * больше нет, не для самого расчёта пригодности.
 */

import { Client } from "@/types/client";
import { Bank, MortgageProgram } from "@/types/bank";
import { calculateAffordability } from "./affordability";
import { calculateAge } from "./format";
import { formatTenge } from "./format";

export interface ProgramMatch {
  program: MortgageProgram;
  bank: Bank;
  eligible: boolean;
  reasons: string[]; // причины несоответствия (пусто, если eligible)
  estimatedMonthlyPayment: number | null; // аннуитетный платёж по requiredLoanAmount
  debtToIncomeRatio: number | null; // (текущие платежи + платёж по этой программе) / доход семьи, %
}

/** Аннуитетный ежемесячный платёж. Возвращает null, если данных недостаточно. */
export function calculateAnnuityPayment(
  principal: number,
  annualRatePercent: number,
  termYears: number
): number | null {
  if (principal <= 0 || termYears <= 0) return null;
  const months = termYears * 12;
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

/**
 * Сравнивает клиента со всеми активными программами и возвращает список
 * с пометкой "подходит/не подходит" и конкретными причинами отказа —
 * ничего не скрыто и не обобщено, консультант видит точную причину.
 */
export function matchPrograms(
  client: Client,
  banks: Bank[],
  programs: MortgageProgram[]
): ProgramMatch[] {
  const affordability = calculateAffordability(client);
  const downPaymentPercent =
    client.propertyValue > 0 ? (client.downPayment / client.propertyValue) * 100 : 0;
  const age = calculateAge(client.birthDate);

  const results = programs
    .filter((program) => program.active)
    .map((program): ProgramMatch => {
      const bank = banks.find((b) => b.id === program.bankId);
      const reasons: string[] = [];

      if (!bank) {
        reasons.push("Банк программы не найден в справочнике.");
      }

      if (program.minHouseholdIncome && affordability.householdIncome < program.minHouseholdIncome) {
        reasons.push(
          `Доход семьи ${formatTenge(affordability.householdIncome)} ниже минимального ${formatTenge(program.minHouseholdIncome)}`
        );
      }

      if (
        client.propertyValue > 0 &&
        downPaymentPercent + 0.001 < program.minDownPaymentPercent
      ) {
        reasons.push(
          `Первоначальный взнос ${downPaymentPercent.toFixed(1)}% ниже минимального ${program.minDownPaymentPercent}%`
        );
      }

      if (program.minLoanAmount && client.requiredLoanAmount > 0 && client.requiredLoanAmount < program.minLoanAmount) {
        reasons.push(`Сумма ипотеки ниже минимальной ${formatTenge(program.minLoanAmount)}`);
      }
      if (program.maxLoanAmount && client.requiredLoanAmount > program.maxLoanAmount) {
        reasons.push(`Сумма ипотеки превышает максимальную ${formatTenge(program.maxLoanAmount)}`);
      }

      if (age !== null) {
        if (program.minBorrowerAge && age < program.minBorrowerAge) {
          reasons.push(`Возраст ${age} меньше минимального ${program.minBorrowerAge}`);
        }
        if (program.maxBorrowerAge && age > program.maxBorrowerAge) {
          reasons.push(`Возраст ${age} больше максимального ${program.maxBorrowerAge}`);
        }
      }

      if (program.minChildrenCount && client.childrenCount < program.minChildrenCount) {
        reasons.push(`Требуется не менее ${program.minChildrenCount} детей`);
      }

      if (
        program.eligibleMaritalStatuses &&
        program.eligibleMaritalStatuses.length > 0 &&
        !program.eligibleMaritalStatuses.includes(client.maritalStatus)
      ) {
        reasons.push("Не подходит по семейному положению");
      }

      if (
        program.allowedCities &&
        program.allowedCities.length > 0 &&
        !program.allowedCities.some((c) => c.trim().toLowerCase() === client.city.trim().toLowerCase())
      ) {
        reasons.push(`Программа не действует в городе «${client.city}»`);
      }

      const estimatedMonthlyPayment =
        client.requiredLoanAmount > 0
          ? calculateAnnuityPayment(
              client.requiredLoanAmount,
              program.interestRatePercent,
              program.maxTermYears
            )
          : null;

      let debtToIncomeRatio: number | null = null;
      if (estimatedMonthlyPayment !== null && affordability.householdIncome > 0) {
        debtToIncomeRatio =
          ((affordability.existingDebtPayments + estimatedMonthlyPayment) /
            affordability.householdIncome) *
          100;
        if (program.maxDebtToIncomeRatio && debtToIncomeRatio > program.maxDebtToIncomeRatio) {
          reasons.push(
            `Долговая нагрузка ${debtToIncomeRatio.toFixed(0)}% превышает допустимую ${program.maxDebtToIncomeRatio}%`
          );
        }
      }

      return {
        program,
        bank: bank as Bank,
        eligible: reasons.length === 0,
        reasons,
        estimatedMonthlyPayment,
        debtToIncomeRatio,
      };
    })
    .filter((match) => match.bank);

  return results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return a.program.interestRatePercent - b.program.interestRatePercent;
  });
}
