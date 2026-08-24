/**
 * documentAnalysis.ts — логика AI-анализа одного документа.
 *
 * Берёт файл (base64), формирует промпт (lib/ai/prompts.ts), вызывает
 * callGemini (lib/ai/gemini.ts) и парсит ответ в DocumentAnalysisResult.
 * Импортируется только серверным кодом (app/api/ai/analyze-document).
 */

import {
  DocumentAnalysisResult,
  DocumentType,
  DocumentWarning,
  ExtractedFields,
} from "@/types/document";
import { callGemini } from "./gemini";
import { getDocumentPrompt } from "./prompts";

export interface AnalyzeDocumentFileInput {
  documentType: DocumentType;
  fileName: string;
  mimeType: string;
  base64Data: string;
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

interface RawGeminiResult {
  documentType?: unknown;
  fields?: unknown;
  warnings?: unknown;
}

function parseGeminiJson(raw: string): RawGeminiResult {
  const cleaned = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("не объект");
    }
    return parsed as RawGeminiResult;
  } catch {
    throw new Error(
      "Gemini вернул ответ, который не удалось разобрать как JSON. Попробуйте повторить анализ."
    );
  }
}

function normalizeFields(rawFields: unknown): ExtractedFields {
  if (typeof rawFields !== "object" || rawFields === null || Array.isArray(rawFields)) {
    return {};
  }
  const result: ExtractedFields = {};
  for (const [key, value] of Object.entries(rawFields as Record<string, unknown>)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      // Ожидаем массив кредитных линий (credit_history) — берём как есть,
      // не изобретая значения, если элемент не похож на объект.
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null ? item : null
      ) as ExtractedFields[string];
      continue;
    }
    // Неожиданный вложенный объект — не отбрасываем совсем, приводим к строке,
    // чтобы не потерять данные, но и не пытаемся угадать структуру.
    result[key] = JSON.stringify(value);
  }
  return result;
}

function normalizeWarnings(rawWarnings: unknown): DocumentWarning[] {
  if (!Array.isArray(rawWarnings)) return [];
  return rawWarnings
    .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
    .map((message, index) => ({
      id: `warn-${Date.now()}-${index}`,
      message,
    }));
}

/**
 * Анализирует один документ через Gemini и возвращает строго
 * структурированный DocumentAnalysisResult. Бросает Error с понятным
 * сообщением, если анализ не удался (парсинг JSON, сеть, отсутствие ключа).
 */
export async function analyzeDocumentFile(
  input: AnalyzeDocumentFileInput
): Promise<DocumentAnalysisResult> {
  const prompt = getDocumentPrompt(input.documentType);
  const userPrompt = prompt.buildUserPrompt(input.fileName);

  const rawResponse = await callGemini({
    systemPrompt: prompt.system,
    userPrompt,
    file: { mimeType: input.mimeType, data: input.base64Data },
  });

  const parsed = parseGeminiJson(rawResponse);

  const documentType: DocumentType =
    typeof parsed.documentType === "string" &&
    (parsed.documentType as string).length > 0
      ? (parsed.documentType as DocumentType)
      : input.documentType;

  return {
    documentType,
    fields: normalizeFields(parsed.fields),
    warnings: normalizeWarnings(parsed.warnings),
    rawResponse,
    analyzedAt: new Date().toISOString(),
  };
}
