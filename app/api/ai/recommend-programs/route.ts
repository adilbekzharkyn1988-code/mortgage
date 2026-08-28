import { NextRequest, NextResponse } from "next/server";
import { recommendPrograms } from "@/lib/ai/programRecommendation";
import { Client } from "@/types/client";
import { ProgramMatch } from "@/lib/bankMatching";
import { AffordabilitySummary } from "@/lib/affordability";

export const runtime = "nodejs";

// Как и /api/ai/analyze-case — этот route ничего не читает из localStorage
// (недоступен на сервере), клиент сам считает matchPrograms/affordability
// через lib/bankMatching.ts + lib/affordability.ts и присылает готовый
// список сюда. Сервер только просит Gemini прокомментировать и ранжировать
// уже посчитанное — см. lib/ai/programRecommendation.ts.
interface RecommendRequestBody {
  client?: Client;
  affordability?: AffordabilitySummary;
  eligible?: ProgramMatch[];
  ineligible?: ProgramMatch[];
}

export async function POST(request: NextRequest) {
  let body: RecommendRequestBody;
  try {
    body = (await request.json()) as RecommendRequestBody;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const { client, affordability, eligible, ineligible } = body;

  if (!client) {
    return NextResponse.json({ error: "Не переданы данные клиента." }, { status: 400 });
  }
  if (!affordability) {
    return NextResponse.json({ error: "Не переданы данные о доходах/расходах." }, { status: 400 });
  }
  if (!Array.isArray(eligible) || !Array.isArray(ineligible)) {
    return NextResponse.json({ error: "Не переданы списки программ." }, { status: 400 });
  }

  try {
    const result = await recommendPrograms(client, affordability, eligible, ineligible);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[api/ai/recommend-programs] анализ не удался:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Не удалось получить рекомендации по программам.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
