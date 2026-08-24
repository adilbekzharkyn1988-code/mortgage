/**
 * progress.ts — расчёт прогресса ипотечного досье по категориям (п.9, п.13 ТЗ).
 *
 * Прогресс НЕ статичен — считается программно на основе фактически введённых
 * данных клиента и статусов загруженных/подтверждённых документов.
 */

import { Client } from "@/types/client";
import { ClientDocument, DocumentType } from "@/types/document";

export type ProgressCategory =
  | "personal"
  | "income"
  | "credits"
  | "family"
  | "documents";

export const PROGRESS_CATEGORY_LABELS: Record<ProgressCategory, string> = {
  personal: "Личные данные",
  income: "Доход",
  credits: "Кредиты",
  family: "Семья",
  documents: "Документы",
};

export interface DossierProgress {
  categories: Record<ProgressCategory, number>;
  overall: number;
  /** Типы документов, которые ещё нужно собрать для этого клиента. */
  requiredDocumentTypes: DocumentType[];
}

function docOfType(documents: ClientDocument[], type: DocumentType): ClientDocument | undefined {
  // Если документов одного типа несколько — берём наиболее "продвинутый" по статусу.
  const candidates = documents.filter((d) => d.type === type);
  const rank: Record<ClientDocument["status"], number> = {
    error: 0,
    uploaded: 1,
    analyzing: 1,
    analyzed: 2,
    rejected: 1,
    confirmed: 3,
  };
  return candidates.sort((a, b) => rank[b.status] - rank[a.status])[0];
}

function scoreForDocument(doc: ClientDocument | undefined): number {
  if (!doc) return 0;
  if (doc.status === "confirmed") return 100;
  if (doc.status === "analyzed") return 60;
  if (doc.status === "analyzing") return 40;
  if (doc.status === "uploaded") return 30;
  return 0; // error / rejected — как будто документа ещё нет
}

function clampRound(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}

/**
 * Считает прогресс досье по категориям и общий прогресс.
 */
export function calculateDossierProgress(
  client: Client,
  documents: ClientDocument[]
): DossierProgress {
  const identityDoc = docOfType(documents, "identity");
  const incomeDoc = docOfType(documents, "income_certificate");
  const creditDoc = docOfType(documents, "credit_history");
  const spouseDoc = docOfType(documents, "spouse_documents");

  const isMarried = client.maritalStatus === "married";

  // Личные данные: базовые поля клиента введены на консультации (всегда, т.к.
  // обязательны при создании клиента) + подтверждённое удостоверение личности.
  const personal = clampRound(40 + 0.6 * scoreForDocument(identityDoc));

  // Доход: сумма дохода указана на консультации + подтверждена справкой.
  const incomeBase = client.estimatedIncome > 0 ? 30 : 0;
  const income = clampRound(incomeBase + 0.7 * scoreForDocument(incomeDoc));

  // Кредиты: если у клиента вообще нет заявленных кредитов, часть прогресса
  // всё равно зависит от подтверждения кредитной историей (могут быть
  // обязательства, не озвученные на консультации).
  const credits = clampRound(scoreForDocument(creditDoc));

  // Семья: состав семьи известен со слов клиента; если клиент в браке —
  // ждём документы супруга/супруги для полного подтверждения.
  const family = isMarried
    ? clampRound(40 + 0.6 * scoreForDocument(spouseDoc))
    : 100;

  // Документы: доля обязательных документов, доведённых до статуса "Подтверждён".
  const requiredDocumentTypes: DocumentType[] = [
    "identity",
    "income_certificate",
    "credit_history",
    ...(isMarried ? (["spouse_documents"] as DocumentType[]) : []),
  ];
  const confirmedRequiredCount = requiredDocumentTypes.filter(
    (type) => docOfType(documents, type)?.status === "confirmed"
  ).length;
  const documentsScore = clampRound(
    (confirmedRequiredCount / requiredDocumentTypes.length) * 100
  );

  const categories: Record<ProgressCategory, number> = {
    personal,
    income,
    credits,
    family,
    documents: documentsScore,
  };

  const overall = clampRound(
    (categories.personal +
      categories.income +
      categories.credits +
      categories.family +
      categories.documents) /
      5
  );

  const missingRequiredTypes = requiredDocumentTypes.filter(
    (type) => docOfType(documents, type)?.status !== "confirmed"
  );

  return { categories, overall, requiredDocumentTypes: missingRequiredTypes };
}
