/**
 * documentFields.ts — человекочитаемые подписи и форматирование значений
 * для извлечённых полей документа (ExtractedFields). Используется и в
 * модальном окне результата анализа, и в компактном просмотре
 * подтверждённых данных.
 */

import { ExtractedFields } from "@/types/document";
import { formatTenge } from "@/lib/format";

export const FIELD_LABELS: Record<string, string> = {
  fullName: "ФИО",
  birthDate: "Дата рождения",
  iin: "ИИН",
  documentNumber: "Номер документа",
  issueDate: "Дата выдачи",
  expiryDate: "Срок действия",
  issuingAuthority: "Орган выдачи",
  employer: "Работодатель",
  position: "Должность",
  monthlyIncome: "Доход",
  employmentStart: "Дата трудоустройства",
  employmentDuration: "Стаж",
  documentDate: "Дата документа",
  activeCreditsCount: "Действующих кредитов",
  closedCreditsCount: "Закрытых кредитов",
  totalMonthlyPayment: "Ежемесячный платёж (всего)",
  totalOutstandingBalance: "Остаток задолженности",
  overduePaymentsCount: "Просроченных платежей",
  otherObligations: "Прочие обязательства",
  credits: "Кредитные линии",
  documentSubtype: "Тип документа",
  summary: "Описание",
  lastContributionAmount: "Последнее отчисление (ОПВ)",
  lastContributionPeriod: "Период отчисления",
  contributionsCount: "Количество отчислений в выписке",
  computedIncome: "Доход (расчётный, отчисление × 10)",
};

const MONEY_FIELDS = new Set([
  "monthlyIncome",
  "totalMonthlyPayment",
  "totalOutstandingBalance",
  "lastContributionAmount",
  "computedIncome",
]);

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

export function displayFieldValue(key: string, value: ExtractedFields[string]): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "Нет данных";
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return "—";
        const rec = item as unknown as Record<string, unknown>;
        const parts = [rec.creditor, rec.type].filter(Boolean).join(" · ");
        const payment =
          typeof rec.monthlyPayment === "number"
            ? formatTenge(rec.monthlyPayment)
            : "—";
        return `${parts || "Кредит"}: ${payment}/мес`;
      })
      .join("; ");
  }
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (typeof value === "number" && MONEY_FIELDS.has(key)) return formatTenge(value);
  return String(value);
}

// Пустой набор полей для ручного ввода, если Gemini не смог проанализировать
// документ (п.14 ТЗ — "Ввести данные вручную"). Соответствует схемам из
// lib/ai/prompts.ts.
export const BLANK_FIELDS_BY_TYPE: Record<string, ExtractedFields> = {
  identity: {
    fullName: null,
    birthDate: null,
    iin: null,
    documentNumber: null,
    issueDate: null,
    expiryDate: null,
    issuingAuthority: null,
  },
  income_certificate: {
    fullName: null,
    employer: null,
    position: null,
    monthlyIncome: null,
    employmentStart: null,
    employmentDuration: null,
    documentDate: null,
  },
  pension_contributions: {
    fullName: null,
    lastContributionAmount: null,
    lastContributionPeriod: null,
    employer: null,
    contributionsCount: null,
  },
  credit_history: {
    fullName: null,
    activeCreditsCount: null,
    closedCreditsCount: null,
    totalMonthlyPayment: null,
    totalOutstandingBalance: null,
    overduePaymentsCount: null,
    otherObligations: null,
    credits: [],
  },
};

export const GENERIC_BLANK_FIELDS: ExtractedFields = {
  documentSubtype: null,
  fullName: null,
  documentDate: null,
  summary: null,
};
