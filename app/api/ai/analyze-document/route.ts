import { NextRequest, NextResponse } from "next/server";
import { analyzeDocumentFile } from "@/lib/ai/documentAnalysis";
import { DocumentType } from "@/types/document";

export const runtime = "nodejs";

interface AnalyzeRequestBody {
  documentType?: DocumentType;
  fileName?: string;
  mimeType?: string;
  base64Data?: string;
}

const VALID_DOCUMENT_TYPES: DocumentType[] = [
  "identity",
  "income_certificate",
  "credit_history",
  "pension_contributions",
  "spouse_documents",
  "bank_statement",
  "other",
];

// Ориентировочный предел на размер тела запроса (base64 ~ на треть больше
// исходного файла). Держим MVP-документы небольшими — консультант загружает
// сканы/фото, не видео.
const MAX_BASE64_LENGTH = 15 * 1024 * 1024; // ~15 МБ строки base64

export async function POST(request: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Некорректное тело запроса." },
      { status: 400 }
    );
  }

  const { documentType, fileName, mimeType, base64Data } = body;

  if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
    return NextResponse.json(
      { error: "Не указан или неизвестен тип документа." },
      { status: 400 }
    );
  }
  if (!fileName || !base64Data) {
    return NextResponse.json(
      { error: "Не передан файл для анализа." },
      { status: 400 }
    );
  }
  if (base64Data.length > MAX_BASE64_LENGTH) {
    return NextResponse.json(
      { error: "Файл слишком большой для AI-анализа в MVP-версии." },
      { status: 413 }
    );
  }

  try {
    const result = await analyzeDocumentFile({
      documentType,
      fileName,
      mimeType: mimeType || "application/octet-stream",
      base64Data,
    });
    return NextResponse.json({ result });
  } catch (error) {
    // Никогда не отдаём клиенту технический stack trace (п.14 ТЗ).
    console.error("[api/ai/analyze-document] анализ не удался:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Не удалось проанализировать документ.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
