"use client";

import { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DossierAnalysis, RISK_SEVERITY_LABELS } from "@/types/mortgageCase";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatTenge } from "@/lib/format";
import { AddToTaskPlanButton } from "@/components/tasks/AddToTaskPlanButton";

interface CaseAnalysisPanelProps {
  analysis: DossierAnalysis;
  // ЭТАП 4: если переданы — под каждой рекомендацией появляется кнопка
  // "Добавить в план", создающая задачу консультанта из рекомендации AI.
  caseId?: string;
  onTaskCreated?: () => void;
}

// Рекомендации хранятся строкой вида "Заголовок: описание" (см.
// normalizeRecommendations в lib/ai/caseAnalysis.ts). Разбираем её обратно
// на заголовок/описание для карточки задачи (ЭТАП 4).
function splitRecommendation(rec: string): { title: string; description: string } {
  const separatorIndex = rec.indexOf(": ");
  if (separatorIndex === -1) return { title: rec, description: rec };
  return {
    title: rec.slice(0, separatorIndex),
    description: rec.slice(separatorIndex + 2),
  };
}

export function CaseAnalysisPanel({ analysis, caseId, onTaskCreated }: CaseAnalysisPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    confirmed: false,
    discrepancies: false,
    risks: false,
    missing: false,
    recommendations: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const highRisksCount = analysis.risks.filter((r) => r.severity === "high").length;
  const mediumRisksCount = analysis.risks.filter((r) => r.severity === "medium").length;

  return (
    <Card>
      <CardHeader eyebrow="Анализ досье" title="AI-анализ всего дела" />
      <div className="flex flex-col gap-5 p-5">
        {/* Дата анализа */}
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface-sunken px-4 py-3">
          <span className="text-xs text-ink-faint">Последний анализ:</span>
          <span className="text-sm font-medium text-ink">{formatDate(analysis.createdAt)}</span>
        </div>

        {/* Краткое резюме */}
        {analysis.confirmed.length > 0 ||
        analysis.missing.length > 0 ||
        analysis.discrepancies.length > 0 ||
        analysis.risks.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {analysis.confirmed.length > 0 && (
              <div className="rounded-lg border border-success/20 bg-success-soft px-3 py-2">
                <p className="text-xs text-ink-faint">✓ Подтверждено</p>
                <p className="mt-1 font-data text-xl font-medium text-success">
                  {analysis.confirmed.length}
                </p>
              </div>
            )}
            {analysis.missing.length > 0 && (
              <div className="rounded-lg border border-warning/20 bg-warning-soft px-3 py-2">
                <p className="text-xs text-ink-faint">○ Не хватает</p>
                <p className="mt-1 font-data text-xl font-medium text-warning">
                  {analysis.missing.length}
                </p>
              </div>
            )}
            {analysis.discrepancies.length > 0 && (
              <div className="rounded-lg border border-risk/20 bg-risk-soft px-3 py-2">
                <p className="text-xs text-ink-faint">⚠️ Несоответствия</p>
                <p className="mt-1 font-data text-xl font-medium text-risk">
                  {analysis.discrepancies.length}
                </p>
              </div>
            )}
            {analysis.risks.length > 0 && (
              <div className="rounded-lg border border-risk/20 bg-risk-soft px-3 py-2">
                <p className="text-xs text-ink-faint">🟡 Риски</p>
                <p className="mt-1 font-data text-xl font-medium text-risk">
                  {highRisksCount > 0 ? highRisksCount : mediumRisksCount > 0 ? mediumRisksCount : analysis.risks.length}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* ПОДТВЕРЖДЕНО */}
        {analysis.confirmed.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection("confirmed")}
              className="flex w-full items-center justify-between rounded-lg border border-line px-4 py-3 hover:bg-surface-sunken"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success" />
                <span className="text-sm font-medium text-ink">✓ Подтверждено</span>
                <Badge tone="success">{analysis.confirmed.length}</Badge>
              </div>
              {expandedSections.confirmed ? (
                <ChevronUp size={16} className="text-ink-soft" />
              ) : (
                <ChevronDown size={16} className="text-ink-soft" />
              )}
            </button>
            {expandedSections.confirmed && (
              <div className="mt-2 space-y-2 pl-4">
                {analysis.confirmed.map((msg, idx) => (
                  <p key={idx} className="text-sm text-ink-soft">
                    • {msg}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* НЕСООТВЕТСТВИЯ */}
        {analysis.discrepancies.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection("discrepancies")}
              className="flex w-full items-center justify-between rounded-lg border border-line px-4 py-3 hover:bg-surface-sunken"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-risk" />
                <span className="text-sm font-medium text-ink">⚠️ Несоответствия</span>
                <Badge tone="risk">{analysis.discrepancies.length}</Badge>
              </div>
              {expandedSections.discrepancies ? (
                <ChevronUp size={16} className="text-ink-soft" />
              ) : (
                <ChevronDown size={16} className="text-ink-soft" />
              )}
            </button>
            {expandedSections.discrepancies && (
              <div className="mt-2 space-y-3 pl-4">
                {analysis.discrepancies.map((disc) => (
                  <div
                    key={disc.id}
                    className="rounded border border-risk/30 bg-risk-soft/30 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-risk">{disc.field}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {disc.sourceA}: <span className="font-data font-medium">{disc.valueA}</span>
                    </p>
                    <p className="text-xs text-ink-soft">
                      {disc.sourceB}: <span className="font-data font-medium">{disc.valueB}</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-faint italic">Обнаружено {formatDate(disc.detectedAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* РИСКИ */}
        {analysis.risks.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection("risks")}
              className="flex w-full items-center justify-between rounded-lg border border-line px-4 py-3 hover:bg-surface-sunken"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-warning" />
                <span className="text-sm font-medium text-ink">🟡 Возможные риски</span>
                <Badge tone="risk">{analysis.risks.length}</Badge>
              </div>
              {expandedSections.risks ? (
                <ChevronUp size={16} className="text-ink-soft" />
              ) : (
                <ChevronDown size={16} className="text-ink-soft" />
              )}
            </button>
            {expandedSections.risks && (
              <div className="mt-2 space-y-3 pl-4">
                {analysis.risks.map((risk) => (
                  <div
                    key={risk.id}
                    className="rounded border border-warning/30 bg-warning-soft/30 px-3 py-2 text-sm"
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-warning">{risk.title}</p>
                      <Badge tone={risk.severity === "high" ? "risk" : risk.severity === "medium" ? "warn" : "neutral"}>
                        {RISK_SEVERITY_LABELS[risk.severity]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">{risk.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* НЕ ХВАТАЕТ */}
        {analysis.missing.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection("missing")}
              className="flex w-full items-center justify-between rounded-lg border border-line px-4 py-3 hover:bg-surface-sunken"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-ink-soft" />
                <span className="text-sm font-medium text-ink">○ Отсутствующие данные</span>
                <Badge tone="neutral">{analysis.missing.length}</Badge>
              </div>
              {expandedSections.missing ? (
                <ChevronUp size={16} className="text-ink-soft" />
              ) : (
                <ChevronDown size={16} className="text-ink-soft" />
              )}
            </button>
            {expandedSections.missing && (
              <div className="mt-2 space-y-2 pl-4">
                {analysis.missing.map((msg, idx) => (
                  <p key={idx} className="text-sm text-ink-soft">
                    • {msg}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* КРЕДИТНАЯ НАГРУЗКА */}
        {analysis.creditBurden && (
          <div className="rounded-lg border border-line px-4 py-3.5">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Кредитная нагрузка
            </p>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-ink-faint">Платежи/мес</p>
                <p className="font-data text-sm font-medium text-ink">
                  {formatTenge(analysis.creditBurden.monthlyPayments)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Доход/мес</p>
                <p className="font-data text-sm font-medium text-ink">
                  {formatTenge(analysis.creditBurden.income)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Соотношение</p>
                <p
                  className={`font-data text-sm font-medium ${
                    analysis.creditBurden.ratio >= 50
                      ? "text-risk"
                      : analysis.creditBurden.ratio >= 35
                        ? "text-warning"
                        : "text-success"
                  }`}
                >
                  {Math.round(analysis.creditBurden.ratio)}%
                </p>
              </div>
            </div>
            <p className="text-sm text-ink-soft">{analysis.creditBurden.message}</p>
          </div>
        )}

        {/* РЕКОМЕНДАЦИИ */}
        {analysis.recommendations.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection("recommendations")}
              className="flex w-full items-center justify-between rounded-lg border border-line px-4 py-3 hover:bg-surface-sunken"
            >
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-navy" />
                <span className="text-sm font-medium text-ink">РЕКОМЕНДАЦИИ</span>
                <Badge tone="navy">{analysis.recommendations.length}</Badge>
              </div>
              {expandedSections.recommendations ? (
                <ChevronUp size={16} className="text-ink-soft" />
              ) : (
                <ChevronDown size={16} className="text-ink-soft" />
              )}
            </button>
            {expandedSections.recommendations && (
              <div className="mt-2 space-y-3 pl-4">
                {analysis.recommendations.map((rec, idx) => {
                  const { title, description } = splitRecommendation(rec);
                  return (
                    <div key={idx} className="flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <Zap size={14} className="mt-1 shrink-0 text-navy" />
                        <p className="text-sm text-ink-soft">{rec}</p>
                      </div>
                      {caseId && (
                        <div className="pl-5">
                          <AddToTaskPlanButton
                            caseId={caseId}
                            recommendation={{ title, description, priority: "medium" }}
                            recommendationId={`rec_${idx}`}
                            onTaskCreated={onTaskCreated}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!analysis.confirmed.length &&
          !analysis.missing.length &&
          !analysis.discrepancies.length &&
          !analysis.risks.length &&
          !analysis.recommendations.length && (
            <p className="text-sm text-ink-soft italic">Анализ не выявил замечаний.</p>
          )}
      </div>
    </Card>
  );
}
