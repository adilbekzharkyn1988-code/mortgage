/**
 * matching.ts — сопоставление подтверждённых данных документа с уже
 * введёнными данными клиента (п.11 ТЗ ЭТАПА 2).
 *
 * Найденное расхождение НЕ считается автоматически ошибкой — только
 * поводом для проверки консультантом ("Обнаружено расхождение, требуется
 * проверка консультанта").
 */

import { Client } from "@/types/client";
import { DocumentType, ExtractedFields, PensionContributionItem } from "@/types/document";
import { Discrepancy } from "@/types/mortgageCase";
import { formatTenge } from "@/lib/format";
import { calculateIncomeFromPensionContributions } from "@/lib/income";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function asNumber(value: ExtractedFields[string]): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: ExtractedFields[string]): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

// Доход считаем расходящимся, только если разница заметна (не из-за округления).
const INCOME_TOLERANCE = 1;
const PAYMENT_TOLERANCE = 1;

/**
 * Сравнивает подтверждённые поля документа с данными клиента, введёнными на
 * консультации, и возвращает список найденных расхождений (может быть пустым).
 */
export function findDiscrepancies(
  client: Client,
  documentType: DocumentType,
  confirmedFields: ExtractedFields
): Discrepancy[] {
  const now = new Date().toISOString();
  const discrepancies: Discrepancy[] = [];

  if (documentType === "identity") {
    const docName = asString(confirmedFields.fullName);
    if (docName && normalizeName(docName) !== normalizeName(client.fullName)) {
      discrepancies.push({
        id: generateId("disc"),
        field: "ФИО",
        sourceA: "Консультация",
        valueA: client.fullName,
        sourceB: "Удостоверение личности",
        valueB: docName,
        detectedAt: now,
      });
    }

    const docBirthDate = asString(confirmedFields.birthDate);
    if (docBirthDate && client.birthDate && docBirthDate !== client.birthDate) {
      discrepancies.push({
        id: generateId("disc"),
        field: "Дата рождения",
        sourceA: "Консультация",
        valueA: client.birthDate,
        sourceB: "Удостоверение личности",
        valueB: docBirthDate,
        detectedAt: now,
      });
    }
  }

  if (documentType === "income_certificate") {
    const docIncome = asNumber(confirmedFields.monthlyIncome);
    if (
      docIncome !== null &&
      Math.abs(docIncome - client.estimatedIncome) > INCOME_TOLERANCE
    ) {
      discrepancies.push({
        id: generateId("disc"),
        field: "Доход",
        sourceA: "Консультация",
        valueA: formatTenge(client.estimatedIncome),
        sourceB: "Справка о доходах",
        valueB: formatTenge(docIncome),
        detectedAt: now,
      });
    }
  }

  // Пенсионные отчисления: зарплата считается как среднее отчисление за
  // последний год × 10 (обязательные пенсионные взносы — 10% от официального
  // дохода). См. lib/income.ts.
  if (documentType === "pension_contributions") {
    const contributions = Array.isArray(confirmedFields.contributions)
      ? (confirmedFields.contributions as unknown as PensionContributionItem[])
      : [];
    const computedIncome = calculateIncomeFromPensionContributions(contributions);
    if (computedIncome > 0) {
      if (Math.abs(computedIncome - client.estimatedIncome) > INCOME_TOLERANCE) {
        discrepancies.push({
          id: generateId("disc"),
          field: "Доход",
          sourceA: "Консультация",
          valueA: formatTenge(client.estimatedIncome),
          sourceB: "Пенсионные отчисления (среднее за год × 10)",
          valueB: formatTenge(computedIncome),
          detectedAt: now,
        });
      }
    }
  }

  if (documentType === "credit_history") {
    const docMonthlyPayment = asNumber(confirmedFields.totalMonthlyPayment);
    if (
      docMonthlyPayment !== null &&
      Math.abs(docMonthlyPayment - client.estimatedMonthlyPayments) > PAYMENT_TOLERANCE
    ) {
      discrepancies.push({
        id: generateId("disc"),
        field: "Ежемесячные платежи по кредитам",
        sourceA: "Консультация",
        valueA: formatTenge(client.estimatedMonthlyPayments),
        sourceB: "Кредитная история",
        valueB: formatTenge(docMonthlyPayment),
        detectedAt: now,
      });
    }
  }

  return discrepancies;
}
