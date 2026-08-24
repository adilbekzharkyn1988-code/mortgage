import { CASE_STAGE_LABELS, CASE_STAGE_ORDER, CaseStage } from "@/types/mortgageCase";
import { Check } from "lucide-react";

/**
 * Пошаговый индикатор этапа дела, стилизованный под вкладки папки
 * с документами — визуальная метафора "досье", которое физически
 * продвигается слева направо по стадиям.
 */
export function CaseStageStepper({ stage }: { stage: CaseStage }) {
  const activeIndex = CASE_STAGE_ORDER.indexOf(stage);

  return (
    <ol className="flex w-full flex-col gap-2 sm:flex-row sm:gap-1.5">
      {CASE_STAGE_ORDER.map((s, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <li key={s} className="flex-1">
            <div
              className={`relative flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-navy bg-navy text-white"
                  : isDone
                    ? "border-success/25 bg-success-soft text-success"
                    : "border-line-strong bg-surface-sunken text-ink-faint"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isActive
                    ? "bg-brass text-navy-dark"
                    : isDone
                      ? "bg-success text-white"
                      : "bg-line-strong text-ink-faint"
                }`}
              >
                {isDone ? <Check size={12} strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="truncate font-medium">{CASE_STAGE_LABELS[s]}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
