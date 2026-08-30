import { NextRequest, NextResponse } from "next/server";
import { analyzeMortgageCase } from "@/lib/ai/caseAnalysis";
import { Client } from "@/types/client";
import { ClientDocument, ExtractedFields } from "@/types/document";
import { Discrepancy, MortgageCase } from "@/types/mortgageCase";
import type { ProgramMatch } from "@/lib/bankMatching";
import type { AffordabilitySummary } from "@/lib/affordability";

export const runtime = "nodejs";

/**
 * ЭТАП 4.1: этот route НЕ обращается к caseService/clientService/documentService.
 *
 * Эти сервисы читают/пишут через localStorage (см. lib/services/storageAdapter.ts),
 * который существует только в браузере. На сервере (в Route Handler) window
 * недоступен, поэтому такие вызовы либо не видят реальных данных консультанта,
 * либо тихо работают с seed-данными — сервер и клиент оказываются в разных
 * "мирах" хранения.
 *
 * Правильная схема: клиент сам читает localStorage через свои сервисы,
 * собирает нужные данные дела и присылает их сюда в теле запроса. Сервер
 * только выполняет анализ (единственное, что действительно должно быть на
 * сервере — вызов Gemini с приватным GEMINI_API_KEY) и возвращает результат.
 * Сохранение результата обратно в localStorage — снова задача клиента
 * (см. lib/services/aiService.ts).
 */
interface AnalyzeCaseRequestBody {
  client?: Client;
  mortgageCase?: MortgageCase;
  documents?: ClientDocument[];
  confirmedIdentity?: ExtractedFields | null;
  confirmedIncome?: ExtractedFields | null;
  confirmedCredit?: ExtractedFields | null;
  existingDiscrepancies?: Discrepancy[];
  affordability?: AffordabilitySummary;
  eligiblePrograms?: ProgramMatch[];
  ineligiblePrograms?: ProgramMatch[];
}

export async function POST(request: NextRequest) {
  let body: AnalyzeCaseRequestBody;
  try {
    body = (await request.json()) as AnalyzeCaseRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Некорректное тело запроса." },
      { status: 400 }
    );
  }

  const { client, mortgageCase, documents } = body;

  if (!client) {
    return NextResponse.json({ error: "Не переданы данные клиента." }, { status: 400 });
  }
  if (!mortgageCase) {
    return NextResponse.json({ error: "Не переданы данные дела." }, { status: 400 });
  }
  if (!Array.isArray(documents)) {
    return NextResponse.json({ error: "Не переданы данные документов." }, { status: 400 });
  }

  try {
    const analysis = await analyzeMortgageCase({
      clientId: client.id,
      client,
      case: mortgageCase,
      documents,
      confirmedIdentity: body.confirmedIdentity ?? null,
      confirmedIncome: body.confirmedIncome ?? null,
      confirmedCredit: body.confirmedCredit ?? null,
      existingDiscrepancies: body.existingDiscrepancies ?? mortgageCase.discrepancies ?? [],
      affordability: body.affordability ?? null,
      eligiblePrograms: body.eligiblePrograms ?? [],
      ineligiblePrograms: body.ineligiblePrograms ?? [],
    });

    // Сохранение результата в дело (localStorage) выполняется на клиенте,
    // в aiService.analyzeDossier — сервер localStorage не видит и ничего
    // не хранит сам.
    return NextResponse.json({ result: analysis });
  } catch (error) {
    console.error("[api/ai/analyze-case] анализ не удался:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Не удалось выполнить анализ досье.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
