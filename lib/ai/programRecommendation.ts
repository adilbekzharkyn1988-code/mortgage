/**
 * programRecommendation.ts — AI-объяснение и ранжирование банковских
 * программ, пригодность которых уже посчитана детерминированно
 * (lib/bankMatching.ts). Gemini здесь ничего не считает и не решает "подходит
 * ли клиент" — только комментирует и расставляет приоритеты среди готового
 * списка, что и проверяется при разборе ответа (см. normalizeRecommended).
 */

import { Client } from "@/types/client";
import { ProgramMatch } from "@/lib/bankMatching";
import { AffordabilitySummary } from "@/lib/affordability";
import { formatTenge } from "@/lib/format";
import { callGemini } from "./gemini";
import { getProgramRecommendationPrompt } from "./prompts";

export interface ProgramRecommendationItem {
  programId: string;
  rationale: string;
}

export interface ProgramRecommendationResult {
  id: string;
  createdAt: string;
  summary: string;
  recommended: ProgramRecommendationItem[];
  improvementTips: string[];
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

interface RawResult {
  summary?: unknown;
  recommended?: unknown;
  improvementTips?: unknown;
}

function parseGeminiJson(raw: string): RawResult {
  const cleaned = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("не объект");
    }
    return parsed as RawResult;
  } catch {
    throw new Error(
      "Gemini вернул ответ, который не удалось разобрать как JSON. Попробуйте повторить."
    );
  }
}

function asString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function buildPrompt(
  client: Client,
  affordability: AffordabilitySummary,
  eligible: ProgramMatch[],
  ineligible: ProgramMatch[]
): string {
  const lines: string[] = [];

  lines.push("=== ФИНАНСОВЫЙ ПРОФИЛЬ КЛИЕНТА ===");
  lines.push(`Город: ${client.city}`);
  lines.push(`Суммарный доход семьи: ${formatTenge(affordability.householdIncome)}`);
  lines.push(
    `Иждивенцы: ${affordability.dependentsCount} (дети: ${client.childrenCount}${
      affordability.isSpouseDependent ? " + неработающий(ая) супруг(а)" : ""
    })`
  );
  lines.push(`Текущие платежи по кредитам: ${formatTenge(affordability.existingDebtPayments)}`);
  lines.push(`Располагаемый доход после иждивенцев и текущих кредитов: ${formatTenge(affordability.disposableIncome)}`);
  lines.push(`Требуемая сумма ипотеки: ${formatTenge(client.requiredLoanAmount)}`);
  lines.push(`Первоначальный взнос: ${formatTenge(client.downPayment)}`);

  lines.push("\n=== ПОДХОДЯЩИЕ ПРОГРАММЫ (по расчёту) ===");
  if (eligible.length === 0) {
    lines.push("Нет ни одной подходящей программы по текущим данным.");
  } else {
    eligible.forEach((m) => {
      lines.push(
        `- programId: ${m.program.id} | ${m.bank.name} — «${m.program.name}» | ставка ${m.program.interestRatePercent}% | ` +
          `срок до ${m.program.maxTermYears} лет | расчётный платёж ${
            m.estimatedMonthlyPayment ? formatTenge(m.estimatedMonthlyPayment) : "н/д"
          }` +
          (m.debtToIncomeRatio !== null ? ` | нагрузка ${m.debtToIncomeRatio.toFixed(0)}%` : "")
      );
    });
  }

  lines.push("\n=== НЕ ПОДХОДЯЩИЕ ПРОГРАММЫ (с причиной) ===");
  if (ineligible.length === 0) {
    lines.push("Нет.");
  } else {
    ineligible.forEach((m) => {
      lines.push(
        `- programId: ${m.program.id} | ${m.bank.name} — «${m.program.name}»: ${m.reasons.join("; ")}`
      );
    });
  }

  lines.push("\n=== ЗАДАЧА ===");
  lines.push(
    "Отранжируй подходящие программы по приоритету для клиента и объясни каждую " +
      "коротко. При необходимости добавь советы по improvementTips на основе " +
      "неподходящих программ. Используй только programId из списков выше."
  );

  return lines.join("\n");
}

function normalizeRecommended(raw: unknown, validIds: Set<string>): ProgramRecommendationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const r = item as Record<string, unknown>;
      // Отбрасываем любой programId, которого не было в переданном списке
      // подходящих программ — Gemini не может "одобрить" то, чего не давали.
      return typeof r.programId === "string" && validIds.has(r.programId);
    })
    .map((item) => {
      const r = item as Record<string, unknown>;
      return { programId: asString(r.programId), rationale: asString(r.rationale) };
    });
}

function normalizeTips(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}

export async function recommendPrograms(
  client: Client,
  affordability: AffordabilitySummary,
  eligible: ProgramMatch[],
  ineligible: ProgramMatch[]
): Promise<ProgramRecommendationResult> {
  const userPrompt = buildPrompt(client, affordability, eligible, ineligible);
  const prompt = getProgramRecommendationPrompt(userPrompt);

  const rawResponse = await callGemini({
    systemPrompt: prompt.system,
    userPrompt: prompt.buildUserPrompt(""),
  });

  const parsed = parseGeminiJson(rawResponse);
  const validIds = new Set(eligible.map((m) => m.program.id));

  return {
    id: `program-rec-${Date.now()}`,
    createdAt: new Date().toISOString(),
    summary: asString(parsed.summary),
    recommended: normalizeRecommended(parsed.recommended, validIds),
    improvementTips: normalizeTips(parsed.improvementTips),
  };
}
