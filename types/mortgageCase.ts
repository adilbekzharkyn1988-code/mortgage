// Типы для "ипотечного дела" — сущности, которая сопровождает клиента
// от консультации до подготовки досье к подаче в банк.

export type CaseStage =
  | "consultation" // Консультация
  | "document_collection" // Сбор документов
  | "dossier_analysis" // Анализ досье
  | "submission_preparation"; // Подготовка к подаче

export const CASE_STAGE_ORDER: CaseStage[] = [
  "consultation",
  "document_collection",
  "dossier_analysis",
  "submission_preparation",
];

export const CASE_STAGE_LABELS: Record<CaseStage, string> = {
  consultation: "Консультация",
  document_collection: "Сбор документов",
  dossier_analysis: "Анализ досье",
  submission_preparation: "Подготовка к подаче",
};

export const CASE_STAGE_SHORT_LABELS: Record<CaseStage, string> = {
  consultation: "Консультация",
  document_collection: "Документы",
  dossier_analysis: "Анализ",
  submission_preparation: "Подача",
};

export type RiskSeverity = "low" | "medium" | "high";

export const RISK_SEVERITY_LABELS: Record<RiskSeverity, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

// Несоответствие между разными источниками данных
// (например: доход по консультации vs доход по справке).
export interface Discrepancy {
  id: string;
  field: string; // человекочитаемое имя поля, напр. "Доход"
  sourceA: string; // например "Консультация"
  valueA: string;
  sourceB: string; // например "Справка о доходах"
  valueB: string;
  detectedAt: string; // ISO datetime
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  relatedField?: string;
}

// Результат AI-анализа всего досье целиком.
export interface DossierAnalysis {
  id: string;
  createdAt: string; // ISO datetime
  confirmed: string[]; // "Что подтверждено"
  missing: string[]; // "Чего не хватает"
  discrepancies: Discrepancy[]; // "Несоответствия"
  risks: Risk[]; // "Потенциальные риски"
  recommendations: string[]; // "Рекомендованные действия" (тексты рекомендаций)
}

export interface MortgageCase {
  id: string;
  clientId: string;

  stage: CaseStage;
  progressPercent: number; // 0–100, показывается в карточке клиента

  // Документы и задачи хранятся отдельно (documentService / taskService),
  // здесь — только ссылки/агрегаты для быстрого отображения.
  documentIds: string[];
  taskIds: string[];

  discrepancies: Discrepancy[];
  analyses: DossierAnalysis[]; // история AI-анализов досье

  nextActionTaskId?: string; // id задачи, которая является "следующим действием"

  createdAt: string;
  updatedAt: string;
}
