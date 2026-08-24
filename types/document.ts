// Типы для документов клиента и результатов их AI-анализа.

export type DocumentType =
  | "identity" // удостоверение личности
  | "income_certificate" // справка о доходах
  | "credit_history" // кредитная история
  | "pension_contributions" // пенсионные отчисления
  | "spouse_documents" // документы супруга/супруги
  | "bank_statement" // банковская выписка
  | "other"; // другой документ

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  identity: "Удостоверение личности",
  income_certificate: "Справка о доходах",
  credit_history: "Кредитная история",
  pension_contributions: "Пенсионные отчисления",
  spouse_documents: "Документы супруга/супруги",
  bank_statement: "Банковская выписка",
  other: "Другой документ",
};

export type DocumentStatus =
  | "uploaded" // загружен, анализ ещё не запускался
  | "analyzing" // AI-анализ выполняется
  | "analyzed" // AI вернул результат, ожидает подтверждения консультанта
  | "confirmed" // консультант подтвердил извлечённые данные
  | "rejected"; // консультант отклонил / отменил результат анализа

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  uploaded: "Загружен",
  analyzing: "Анализируется",
  analyzed: "Требует подтверждения",
  confirmed: "Подтверждён",
  rejected: "Отклонён",
};

// Универсальный контейнер извлечённых полей.
// Конкретный набор ключей зависит от document_type (см. lib/ai/prompts.ts).
export type ExtractedFields = Record<string, string | number | null>;

export interface DocumentWarning {
  id: string;
  message: string;
}

export interface DocumentAnalysisResult {
  documentType: DocumentType;
  fields: ExtractedFields;
  warnings: DocumentWarning[];
  rawResponse?: string; // на случай отладки ответа AI
  analyzedAt: string; // ISO datetime
}

export interface ClientDocument {
  id: string;
  clientId: string;
  caseId: string;

  type: DocumentType;
  fileName: string;
  uploadedAt: string; // ISO datetime

  status: DocumentStatus;

  // Заполняется после AI-анализа
  analysisResult?: DocumentAnalysisResult;

  // Заполняется после подтверждения консультантом (может отличаться
  // от analysisResult.fields, если консультант что-то исправил)
  confirmedFields?: ExtractedFields;
  confirmedAt?: string;
}
