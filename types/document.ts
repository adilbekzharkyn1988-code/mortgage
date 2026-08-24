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
  | "uploaded" // загружен, анализ ещё не запускался ("Не анализирован")
  | "analyzing" // AI-анализ выполняется
  | "analyzed" // AI вернул результат, ожидает подтверждения консультанта ("Требует проверки")
  | "confirmed" // консультант подтвердил извлечённые данные
  | "rejected" // консультант отклонил / отменил результат анализа
  | "error"; // Gemini не смог проанализировать документ (см. п.14 ТЗ ЭТАПА 2)

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  uploaded: "Не анализирован",
  analyzing: "Анализируется",
  analyzed: "Требует проверки",
  confirmed: "Подтверждён",
  rejected: "Отклонён",
  error: "Ошибка анализа",
};

// Одна строка из кредитной истории (см. lib/ai/prompts.ts — credit_history).
export interface CreditLineItem {
  creditor: string | null;
  type: string | null;
  remainingBalance: number | null;
  monthlyPayment: number | null;
  status: string | null;
  overdue: boolean | null;
}

// Универсальный контейнер извлечённых полей.
// Конкретный набор ключей зависит от document_type (см. lib/ai/prompts.ts).
// Значение null означает "AI не нашёл это поле в документе" — это осознанный
// результат анализа, а не ошибка, и не должно заменяться выдуманными данными.
export type ExtractedFields = Record<
  string,
  string | number | boolean | null | CreditLineItem[]
>;

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
  fileSizeBytes?: number;
  uploadedAt: string; // ISO datetime

  status: DocumentStatus;

  // Заполняется, если Gemini не смог проанализировать документ (см. п.14 ТЗ).
  lastError?: string;

  // Заполняется после AI-анализа
  analysisResult?: DocumentAnalysisResult;

  // Заполняется после подтверждения консультантом (может отличаться
  // от analysisResult.fields, если консультант что-то исправил)
  confirmedFields?: ExtractedFields;
  confirmedAt?: string;
}
