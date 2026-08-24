/**
 * caseAnalysis.ts — логика AI-анализа всего ипотечного досье (ЭТАП 3).
 *
 * Собирает структурированные данные дела: консультацию, подтверждённые
 * документы, отсутствующие данные, несоответствия — и отправляет в Gemini
 * для анализа. Возвращает структурированный DossierAnalysis.
 */

import { Client } from "@/types/client";
import { ClientDocument, ExtractedFields } from "@/types/document";
import {
  MortgageCase,
  DossierAnalysis,
  Discrepancy,
  Risk,
  RiskSeverity,
} from "@/types/mortgageCase";
import { callGemini } from "./gemini";
import { getCaseAnalysisPrompt } from "./prompts";

interface CaseDataForAnalysis {
  clientId: string;
  client: Client;
  case: MortgageCase;
  documents: ClientDocument[];
  confirmedIdentity: ExtractedFields | null;
  confirmedIncome: ExtractedFields | null;
  confirmedCredit: ExtractedFields | null;
  existingDiscrepancies: Discrepancy[];
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

interface RawCaseAnalysisResult {
  summary?: unknown;
  confirmed?: unknown;
  missing?: unknown;
  discrepancies?: unknown;
  risks?: unknown;
  creditBurden?: unknown;
  recommendations?: unknown;
}

function parseGeminiJson(raw: string): RawCaseAnalysisResult {
  const cleaned = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("не объект");
    }
    return parsed as RawCaseAnalysisResult;
  } catch {
    throw new Error(
      "Gemini вернул ответ, который не удалось разобрать как JSON. Попробуйте повторить анализ."
    );
  }
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeConfirmed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const msg = (item as Record<string, unknown>)?.message;
      return typeof msg === "string" && msg.trim().length > 0;
    })
    .map((item) => asString((item as Record<string, unknown>)?.message));
}

function normalizeMissing(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const msg = (item as Record<string, unknown>)?.message;
      return typeof msg === "string" && msg.trim().length > 0;
    })
    .map((item) => asString((item as Record<string, unknown>)?.message));
}

function normalizeDiscrepancies(raw: unknown): Discrepancy[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const d = item as Record<string, unknown>;
      return typeof d.field === "string" && d.field.trim().length > 0;
    })
    .map((item, index) => {
      const d = item as Record<string, unknown>;
      return {
        id: `discrepancy-${Date.now()}-${index}`,
        field: asString(d.field),
        sourceA: asString(d.sourceA) || "Консультация",
        valueA: asString(d.consultationValue || d.valueA),
        sourceB: asString(d.sourceB) || "Документ",
        valueB: asString(d.documentValue || d.valueB),
        detectedAt: new Date().toISOString(),
      };
    });
}

function normalizeRisks(raw: unknown): Risk[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const r = item as Record<string, unknown>;
      return typeof r.title === "string" && r.title.trim().length > 0;
    })
    .map((item, index) => {
      const r = item as Record<string, unknown>;
      const level = asString(r.level).toLowerCase() as RiskSeverity;
      const isValidLevel = level === "low" || level === "medium" || level === "high";
      return {
        id: `risk-${Date.now()}-${index}`,
        title: asString(r.title),
        description: asString(r.description),
        severity: isValidLevel ? level : "medium",
        relatedField: r.relatedField ? asString(r.relatedField) : undefined,
      };
    });
}

function normalizeRecommendations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const msg = (item as Record<string, unknown>)?.description;
      return typeof msg === "string" && msg.trim().length > 0;
    })
    .map((item) => {
      const r = item as Record<string, unknown>;
      const title = asString(r.title);
      const desc = asString(r.description);
      return title && desc ? `${title}: ${desc}` : desc;
    });
}

function buildCaseAnalysisPrompt(caseData: CaseDataForAnalysis): string {
  const client = caseData.client;
  const confirmedIdentity = caseData.confirmedIdentity;
  const confirmedIncome = caseData.confirmedIncome;
  const confirmedCredit = caseData.confirmedCredit;

  const lines: string[] = [];

  lines.push("=== ДАННЫЕ КОНСУЛЬТАЦИИ ===");
  lines.push(`Клиент: ${client.fullName}`);
  lines.push(`Дата рождения: ${client.birthDate}`);
  lines.push(`Доход (консультация): ${client.estimatedIncome.toLocaleString()} ₸`);
  lines.push(`Доход супруга (консультация): ${client.spouseIncome.toLocaleString()} ₸`);
  lines.push(`Стоимость недвижимости: ${client.propertyValue.toLocaleString()} ₸`);
  lines.push(`Первоначальный взнос: ${client.downPayment.toLocaleString()} ₸`);
  lines.push(`Необходимая ипотека: ${client.requiredLoanAmount.toLocaleString()} ₸`);
  lines.push(`Текущие кредиты: ${client.existingLoans.length}`);
  lines.push(`Ежемесячные платежи (консультация): ${client.estimatedMonthlyPayments.toLocaleString()} ₸`);

  lines.push("\n=== ПОДТВЕРЖДЁННЫЕ ДОКУМЕНТЫ ===");
  if (confirmedIdentity) {
    lines.push(`✓ Удостоверение личности:`);
    lines.push(`  - ФИО: ${confirmedIdentity.fullName || "(не найдено)"}`);
    lines.push(`  - Дата рождения: ${confirmedIdentity.birthDate || "(не найдено)"}`);
    lines.push(`  - ИИН: ${confirmedIdentity.iin || "(не найдено)"}`);
  } else {
    lines.push(`✗ Удостоверение личности: не подтверждено`);
  }

  if (confirmedIncome) {
    lines.push(`✓ Справка о доходах:`);
    lines.push(`  - Работодатель: ${confirmedIncome.employer || "(не найдено)"}`);
    lines.push(`  - Должность: ${confirmedIncome.position || "(не найдено)"}`);
    lines.push(`  - Ежемесячный доход: ${confirmedIncome.monthlyIncome || "(не найдено)"} ₸`);
    lines.push(`  - Стаж работы: ${confirmedIncome.employmentDuration || "(не указан)"}`);
  } else {
    lines.push(`✗ Справка о доходах: не подтверждена`);
  }

  if (confirmedCredit) {
    lines.push(`✓ Кредитная история:`);
    lines.push(`  - Действующих кредитов: ${confirmedCredit.activeCreditsCount || 0}`);
    lines.push(`  - Ежемесячные платежи: ${confirmedCredit.totalMonthlyPayment || "(не найдено)"} ₸`);
    lines.push(`  - Остаток задолженности: ${confirmedCredit.totalOutstandingBalance || "(не найдено)"} ₸`);
    lines.push(`  - Просрочки: ${confirmedCredit.overduePaymentsCount || 0}`);
  } else {
    lines.push(`✗ Кредитная история: не подтверждена`);
  }

  lines.push("\n=== ЗАГРУЖЕННЫЕ ДОКУМЕНТЫ ===");
  const confirmedDocs = caseData.documents.filter((d) => d.status === "confirmed");
  const analyzedDocs = caseData.documents.filter((d) => d.status === "analyzed");
  const uploadedDocs = caseData.documents.filter((d) => d.status === "uploaded");
  const errorDocs = caseData.documents.filter((d) => d.status === "error");

  lines.push(`Подтверждено: ${confirmedDocs.length}`);
  lines.push(`Требует проверки: ${analyzedDocs.length}`);
  lines.push(`Не анализировано: ${uploadedDocs.length}`);
  lines.push(`Ошибка анализа: ${errorDocs.length}`);

  lines.push("\n=== НЕСООТВЕТСТВИЯ ===");
  if (caseData.existingDiscrepancies.length > 0) {
    caseData.existingDiscrepancies.forEach((d) => {
      lines.push(`- ${d.field}: ${d.sourceA} (${d.valueA}) vs ${d.sourceB} (${d.valueB})`);
    });
  } else {
    lines.push("Несоответствий не обнаружено");
  }

  lines.push("\n=== ЗАДАЧА ===");
  lines.push(
    "Проанализируй всё досье целиком. Определи: какие данные подтверждены, " +
      "какие отсутствуют, какие несоответствия между консультацией и документами, " +
      "какие риски, какие рекомендации."
  );
  lines.push(
    "Не выдумывай данные. Если информации недостаточно — напиши 'Недостаточно данных'."
  );

  return lines.join("\n");
}

/**
 * Собирает структурированные данные дела и отправляет в Gemini для анализа.
 * Возвращает DossierAnalysis.
 */
export async function analyzeMortgageCase(
  caseData: CaseDataForAnalysis
): Promise<DossierAnalysis> {
  // Извлечение подтверждённых данных из документов
  const identity = caseData.documents.find((d) => d.type === "identity" && d.status === "confirmed");
  const income = caseData.documents.find(
    (d) => d.type === "income_certificate" && d.status === "confirmed"
  );
  const credit = caseData.documents.find((d) => d.type === "credit_history" && d.status === "confirmed");

  const caseDataWithConfirmed: CaseDataForAnalysis = {
    ...caseData,
    confirmedIdentity: identity?.confirmedFields ?? null,
    confirmedIncome: income?.confirmedFields ?? null,
    confirmedCredit: credit?.confirmedFields ?? null,
  };

  const userPrompt = buildCaseAnalysisPrompt(caseDataWithConfirmed);
  const prompt = getCaseAnalysisPrompt(userPrompt);

  const rawResponse = await callGemini({
    systemPrompt: prompt.system,
    userPrompt: prompt.buildUserPrompt(""),
  });

  const parsed = parseGeminiJson(rawResponse);

  return {
    id: `analysis-${Date.now()}`,
    createdAt: new Date().toISOString(),
    confirmed: normalizeConfirmed(parsed.confirmed),
    missing: normalizeMissing(parsed.missing),
    discrepancies: normalizeDiscrepancies(parsed.discrepancies),
    risks: normalizeRisks(parsed.risks),
    recommendations: normalizeRecommendations(parsed.recommendations),
  };
}
