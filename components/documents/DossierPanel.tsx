"use client";

import { useMemo, useState, useEffect } from "react";
import { Braces, AlertCircle } from "lucide-react";
import { Client } from "@/types/client";
import { ClientDocument, DOCUMENT_TYPE_LABELS, ExtractedFields, INCOME_PROOF_DOCUMENT_TYPES } from "@/types/document";
import { DossierAnalysis } from "@/types/mortgageCase";
import { Card, CardHeader } from "@/components/ui/Card";
import { DetailField } from "@/components/ui/DetailField";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { calculateDossierProgress, PROGRESS_CATEGORY_LABELS } from "@/lib/progress";
import { formatTenge, formatDate } from "@/lib/format";
import { aiService } from "@/lib/services/aiService";
import { caseService } from "@/lib/services/caseService";
import { CaseAnalysisPanel } from "./CaseAnalysisPanel";

function getConfirmed(
  documents: ClientDocument[],
  type: ClientDocument["type"]
): ExtractedFields | null {
  const doc = documents.find((d) => d.type === type && d.status === "confirmed");
  return doc?.confirmedFields ?? null;
}

function asDisplay(value: ExtractedFields[string] | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return "—";
  return String(value);
}

function getConfirmedIncome(documents: ClientDocument[]): ExtractedFields | null {
  const doc = documents
    .filter((d) => INCOME_PROOF_DOCUMENT_TYPES.includes(d.type) && d.status === "confirmed")
    .sort((a, _b) => (a.type === "pension_contributions" ? -1 : 1))[0];
  return doc?.confirmedFields ?? null;
}

export function DossierPanel({
  client,
  documents,
  caseId,
  onAnalysisComplete,
  onTaskCreated,
}: {
  client: Client;
  documents: ClientDocument[];
  caseId?: string;
  onAnalysisComplete?: (analysis: DossierAnalysis) => void;
  // ЭТАП 4: вызывается, когда рекомендация AI-анализа превращена в задачу
  // (кнопка "Добавить в план" внутри CaseAnalysisPanel) — родитель может
  // обновить список задач/следующее действие.
  onTaskCreated?: () => void;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DossierAnalysis | null>(null);

  const progress = useMemo(
    () => calculateDossierProgress(client, documents),
    [client, documents]
  );

  // Загружаем последний анализ при изменении caseId
  const loadLatestAnalysis = async (id: string) => {
    try {
      const caseData = await caseService.getById(id);
      if (caseData && caseData.analyses.length > 0) {
        setAnalysis(caseData.analyses[caseData.analyses.length - 1]);
      }
    } catch (error) {
      console.error("Не удалось загрузить анализ:", error);
    }
  };

  const handleAnalyze = async () => {
    if (!caseId) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await aiService.analyzeDossier(caseId);
      setAnalysis(result);
      onAnalysisComplete?.(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось выполнить анализ досье.";
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Загружаем последний анализ при монтировании или изменении caseId
  useEffect(() => {
    if (caseId) {
      loadLatestAnalysis(caseId);
    }
  }, [caseId]);

  const identity = getConfirmed(documents, "identity");
  const income = getConfirmedIncome(documents);
  const credit = getConfirmed(documents, "credit_history");

  return (
    <>
      <Card>
        <CardHeader eyebrow="Ипотечное дело" title="Досье клиента" />
        <div className="flex flex-col gap-6 p-5">
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Прогресс досье
            </p>
            <p className="font-data text-sm font-medium text-ink">{progress.overall}%</p>
          </div>
          <div className="flex flex-col gap-3">
            {(Object.keys(PROGRESS_CATEGORY_LABELS) as (keyof typeof PROGRESS_CATEGORY_LABELS)[]).map(
              (category) => (
                <ProgressBar
                  key={category}
                  percent={progress.categories[category]}
                  label={PROGRESS_CATEGORY_LABELS[category]}
                />
              )
            )}
          </div>
          {progress.requiredDocumentTypes.length > 0 && (
            <p className="mt-3 text-xs text-ink-faint">
              Не хватает подтверждённых документов:{" "}
              {progress.requiredDocumentTypes
                .map((type) => DOCUMENT_TYPE_LABELS[type])
                .join(", ")}
              .
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Личные данные
            </p>
            {identity ? (
              <Badge tone="success">Подтверждено документом</Badge>
            ) : (
              <Badge tone="neutral">Со слов на консультации</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <DetailField label="ФИО" value={asDisplay(identity?.fullName) !== "—" ? asDisplay(identity?.fullName) : client.fullName} />
            <DetailField
              label="Дата рождения"
              value={
                identity?.birthDate ? formatDate(String(identity.birthDate)) : formatDate(client.birthDate)
              }
            />
            <DetailField label="ИИН" value={asDisplay(identity?.iin)} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Доход</p>
            {income ? (
              <Badge tone="success">Подтверждено документом</Badge>
            ) : (
              <Badge tone="neutral">Со слов на консультации</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <DetailField label="Работодатель" value={asDisplay(income?.employer)} />
            <DetailField
              label={typeof income?.lastContributionAmount === "number" ? "Источник" : "Должность"}
              value={
                typeof income?.lastContributionAmount === "number"
                  ? "Пенсионные отчисления (×10)"
                  : asDisplay(income?.position)
              }
            />
            <DetailField
              label="Доход"
              value={formatTenge(
                typeof income?.lastContributionAmount === "number"
                  ? income.lastContributionAmount * 10
                  : typeof income?.monthlyIncome === "number"
                    ? income.monthlyIncome
                    : client.estimatedIncome
              )}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Кредиты</p>
            {credit ? (
              <Badge tone="success">Подтверждено документом</Badge>
            ) : (
              <Badge tone="neutral">Со слов на консультации</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <DetailField
              label="Действующих кредитов"
              value={
                credit && typeof credit.activeCreditsCount === "number"
                  ? credit.activeCreditsCount
                  : client.existingLoans.length
              }
            />
            <DetailField
              label="Ежемесячные платежи"
              value={formatTenge(
                typeof credit?.totalMonthlyPayment === "number"
                  ? credit.totalMonthlyPayment
                  : client.estimatedMonthlyPayments
              )}
            />
            <DetailField
              label="Остаток задолженности"
              value={
                typeof credit?.totalOutstandingBalance === "number"
                  ? formatTenge(credit.totalOutstandingBalance)
                  : "—"
              }
            />
          </div>
        </div>

        {/* Кнопка анализа досье */}
        {caseId && (
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 font-medium text-white disabled:opacity-50 hover:bg-navy-dark"
            >
              <Braces size={16} />
              {isAnalyzing ? "Анализируем досье..." : "🧠 Анализировать досье"}
            </button>
            {analysisError && (
              <div className="flex items-start gap-2 rounded-lg border border-risk/20 bg-risk-soft px-4 py-3">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-risk" />
                <div>
                  <p className="text-sm font-medium text-risk">Ошибка анализа</p>
                  <p className="mt-1 text-xs text-ink-soft">{analysisError}</p>
                  <button
                    onClick={handleAnalyze}
                    className="mt-2 text-xs font-medium text-risk hover:underline"
                  >
                    Повторить
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </Card>

      {/* Отображение результатов анализа */}
      {analysis && (
        <CaseAnalysisPanel
          analysis={analysis}
          caseId={caseId}
          onTaskCreated={onTaskCreated}
        />
      )}
    </>
  );
}
