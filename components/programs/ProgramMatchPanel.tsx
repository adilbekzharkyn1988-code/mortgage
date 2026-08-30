"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles, XCircle } from "lucide-react";
import { Client } from "@/types/client";
import { PROGRAM_CATEGORY_LABELS } from "@/types/bank";
import { bankService, programService } from "@/lib/services/bankService";
import { calculateAffordability } from "@/lib/affordability";
import { matchPrograms, ProgramMatch } from "@/lib/bankMatching";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DetailField } from "@/components/ui/DetailField";
import { formatTenge } from "@/lib/format";

export function ProgramMatchPanel({ client }: { client: Client }) {
  const [loaded, setLoaded] = useState(false);
  const [matches, setMatches] = useState<ProgramMatch[]>([]);
  const [expandedIneligible, setExpandedIneligible] = useState(false);

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
                  {eligible.map((match) => (
                    <ProgramCard key={match.program.id} match={match} />
                  ))}
                </div>
              )}
            </div>

            {/* Развёрнутый план действий — не дублируем отдельным AI-вызовом
                здесь: полный анализ (с учётом кредитов клиента, расхождений
                и точных причин отказа по каждой программе) считается в
                DossierPanel → "Анализ AI" и там же превращается в задачи. */}
            <div className="border-t border-line pt-4">
              <a
                href="#dossier"
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-navy/20 px-3 py-2 text-sm font-medium text-navy hover:bg-navy-soft/40"
              >
                <Sparkles size={15} />
                Развёрнутый план действий — в разделе «Анализ AI»
              </a>
            </div>

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

function ProgramCard({ match }: { match: ProgramMatch }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        match.eligible ? "border-line" : "border-line bg-surface-sunken"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
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
