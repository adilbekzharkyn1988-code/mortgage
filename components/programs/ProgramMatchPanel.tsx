"use client";

import { useEffect, useMemo, useState } from "react";
import { Braces, CheckCircle2, ChevronDown, ChevronUp, Sparkles, XCircle } from "lucide-react";
import { Client } from "@/types/client";
import { PROGRAM_CATEGORY_LABELS } from "@/types/bank";
import { bankService, programService } from "@/lib/services/bankService";
import { aiService } from "@/lib/services/aiService";
import { calculateAffordability } from "@/lib/affordability";
import { matchPrograms, ProgramMatch } from "@/lib/bankMatching";
import { ProgramRecommendationResult } from "@/lib/ai/programRecommendation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DetailField } from "@/components/ui/DetailField";
import { formatTenge } from "@/lib/format";

export function ProgramMatchPanel({ client }: { client: Client }) {
  const [loaded, setLoaded] = useState(false);
  const [matches, setMatches] = useState<ProgramMatch[]>([]);
  const [expandedIneligible, setExpandedIneligible] = useState(false);

  const [recommendation, setRecommendation] = useState<ProgramRecommendationResult | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  const affordability = useMemo(() => calculateAffordability(client), [client]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [banks, programs] = await Promise.all([bankService.getAll(), programService.getAll()]);
      if (cancelled) return;
      setMatches(matchPrograms(client, banks, programs));
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const eligible = matches.filter((m) => m.eligible);
  const ineligible = matches.filter((m) => !m.eligible);

  async function handleRecommend() {
    setIsRecommending(true);
    setRecommendError(null);
    try {
      const result = await aiService.recommendPrograms(client, affordability, eligible, ineligible);
      setRecommendation(result);
    } catch (error) {
      setRecommendError(
        error instanceof Error ? error.message : "Не удалось получить рекомендации по программам."
      );
    } finally {
      setIsRecommending(false);
    }
  }

  const recommendedOrder = recommendation
    ? recommendation.recommended
        .map((r) => eligible.find((m) => m.program.id === r.programId))
        .filter((m): m is ProgramMatch => Boolean(m))
    : [];
  const recommendedIds = new Set(recommendedOrder.map((m) => m.program.id));
  const restEligible = eligible.filter((m) => !recommendedIds.has(m.program.id));

  return (
    <Card>
      <CardHeader eyebrow="Ипотечное дело" title="Банки и программы" />
      <div className="flex flex-col gap-5 p-5">
        {/* Расчёт располагаемого дохода */}
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Доход и расходы
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DetailField label="Доход семьи" value={formatTenge(affordability.householdIncome)} />
            <DetailField
              label="Иждивенцы"
              value={`${affordability.dependentsCount} (дети: ${client.childrenCount}${
                affordability.isSpouseDependent ? " + супруг(а)" : ""
              })`}
            />
            <DetailField label="Текущие платежи по кредитам" value={formatTenge(affordability.existingDebtPayments)} />
            <DetailField
              label="Располагаемый доход"
              value={formatTenge(affordability.disposableIncome)}
            />
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Располагаемый доход = доход клиента + доход супруга − прожиточный минимум на клиента и
            иждивенцев − текущие платежи по кредитам. Супруг(а) считается иждивенцем, если не
            работает (состоит в браке без собственного дохода) либо клиент в разводе.
          </p>
        </div>

        {!loaded && <p className="text-sm text-ink-soft">Подбираем программы…</p>}

        {loaded && matches.length === 0 && (
          <p className="text-sm text-ink-soft">
            Справочник банков и программ пуст.{" "}
            <a href="/banks" className="font-medium text-navy hover:underline">
              Добавьте банки и программы
            </a>
            , чтобы CRM могла подбирать варианты.
          </p>
        )}

        {loaded && matches.length > 0 && (
          <>
            {/* Подходящие программы */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success" />
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Подходят по расчёту
                </p>
                <Badge tone="success">{eligible.length}</Badge>
              </div>

              {eligible.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  По текущим данным клиента ни одна программа не подошла — см. причины ниже.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {recommendedOrder.map((match, idx) => (
                    <ProgramCard
                      key={match.program.id}
                      match={match}
                      rank={idx + 1}
                      rationale={recommendation?.recommended.find((r) => r.programId === match.program.id)?.rationale}
                    />
                  ))}
                  {restEligible.map((match) => (
                    <ProgramCard key={match.program.id} match={match} />
                  ))}
                </div>
              )}
            </div>

            {/* AI-рекомендация */}
            {eligible.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRecommend}
                  disabled={isRecommending}
                  className="w-fit"
                >
                  <Sparkles size={15} />
                  {isRecommending
                    ? "AI подбирает приоритеты…"
                    : recommendation
                      ? "Обновить рекомендацию AI"
                      : "Получить рекомендацию AI"}
                </Button>
                {recommendError && <p className="text-xs text-risk">{recommendError}</p>}
                {recommendation && (
                  <div className="rounded-lg border border-navy/15 bg-navy-soft/40 px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-navy">
                      <Braces size={13} /> Вывод AI
                    </div>
                    <p className="mt-1.5 text-sm text-ink">{recommendation.summary}</p>
                    {recommendation.improvementTips.length > 0 && (
                      <div className="mt-2.5 flex flex-col gap-1">
                        {recommendation.improvementTips.map((tip, idx) => (
                          <p key={idx} className="text-xs text-ink-soft">
                            💡 {tip}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Неподходящие программы */}
            {ineligible.length > 0 && (
              <div className="border-t border-line pt-4">
                <button
                  onClick={() => setExpandedIneligible((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-surface-sunken"
                >
                  <div className="flex items-center gap-2">
                    <XCircle size={15} className="text-ink-faint" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      Не подходят
                    </span>
                    <Badge tone="neutral">{ineligible.length}</Badge>
                  </div>
                  {expandedIneligible ? (
                    <ChevronUp size={15} className="text-ink-soft" />
                  ) : (
                    <ChevronDown size={15} className="text-ink-soft" />
                  )}
                </button>
                {expandedIneligible && (
                  <div className="mt-2 flex flex-col gap-2.5">
                    {ineligible.map((match) => (
                      <ProgramCard key={match.program.id} match={match} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function ProgramCard({
  match,
  rank,
  rationale,
}: {
  match: ProgramMatch;
  rank?: number;
  rationale?: string;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        match.eligible ? "border-line" : "border-line bg-surface-sunken"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {rank && <Badge tone="navy">#{rank}</Badge>}
            <p className="text-sm font-medium text-ink">
              {match.bank.name} — {match.program.name}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">
            {PROGRAM_CATEGORY_LABELS[match.program.category]} · ставка {match.program.interestRatePercent}% ·
            до {match.program.maxTermYears} лет
          </p>
        </div>
        {match.estimatedMonthlyPayment !== null && (
          <div className="text-right">
            <p className="text-xs text-ink-faint">Платёж/мес</p>
            <p className="font-data text-sm font-medium text-ink">
              {formatTenge(match.estimatedMonthlyPayment)}
            </p>
          </div>
        )}
      </div>

      {rationale && <p className="mt-2 text-sm text-ink-soft">{rationale}</p>}

      {!match.eligible && match.reasons.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {match.reasons.map((reason, idx) => (
            <p key={idx} className="text-xs text-risk">
              • {reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
