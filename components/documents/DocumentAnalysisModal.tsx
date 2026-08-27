"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Pencil, RotateCcw, Wallet, X } from "lucide-react";
import { Client } from "@/types/client";
import {
  ClientDocument,
  CreditLineItem,
  DOCUMENT_TYPE_LABELS,
  ExtractedFields,
} from "@/types/document";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/FormField";
import { findDiscrepancies } from "@/lib/matching";
import { fieldLabel, displayFieldValue } from "@/lib/documentFields";
import { formatTenge } from "@/lib/format";

export function DocumentAnalysisModal({
  document,
  client,
  isRetrying,
  startInEditMode = false,
  onClose,
  onConfirm,
  onRetry,
}: {
  document: ClientDocument;
  client: Client;
  isRetrying: boolean;
  startInEditMode?: boolean;
  onClose: () => void;
  onConfirm: (confirmedFields: ExtractedFields, applyCreditsToClient?: boolean) => void;
  onRetry: () => void;
}) {
  const result = document.analysisResult;
  const [editMode, setEditMode] = useState(startInEditMode);
  const [editedFields, setEditedFields] = useState<ExtractedFields>(
    () => result?.fields ?? {}
  );
  // Кредитная история: AI уже разложил кредиты по строкам (credits) — вместо
  // того, чтобы консультант вручную вбивал каждый кредит в карточку клиента,
  // предлагаем сразу заполнить "Текущие кредиты" этими данными.
  const [applyCreditsToClient, setApplyCreditsToClient] = useState(true);

  const previewDiscrepancies = useMemo(() => {
    if (!result) return [];
    return findDiscrepancies(client, document.type, editedFields);
  }, [client, document.type, editedFields, result]);

  // Список кредитных линий из документа (если это кредитная история и AI
  // нашёл хотя бы одну строку) — показываем консультанту явно, что именно
  // подставится в карточку клиента.
  const creditLines: CreditLineItem[] = useMemo(() => {
    if (document.type !== "credit_history") return [];
    const raw = editedFields.credits;
    return Array.isArray(raw) ? (raw as CreditLineItem[]) : [];
  }, [document.type, editedFields]);

  if (!result) return null;

  const entries = Object.entries(editedFields);
  const missingCount = entries.filter(([, v]) => v === null).length;

  function handleFieldChange(key: string, raw: string) {
    setEditedFields((prev) => {
      const original = result!.fields[key];
      // Сохраняем число как число, если исходное значение было числом.
      if (typeof original === "number") {
        const parsed = Number(raw.replace(/[^\d.-]/g, ""));
        return { ...prev, [key]: Number.isFinite(parsed) ? parsed : null };
      }
      return { ...prev, [key]: raw.length > 0 ? raw : null };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-xl sm:max-w-lg sm:rounded-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              Результат анализа документа
            </p>
            <h2 className="mt-1 font-display text-lg text-ink">
              {DOCUMENT_TYPE_LABELS[result.documentType]}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Найденные данные
            {missingCount > 0 && (
              <span className="ml-2 font-normal normal-case text-ink-faint">
                ({missingCount} {missingCount === 1 ? "поле" : "полей"} не найдено)
              </span>
            )}
          </p>
          <div className="flex flex-col divide-y divide-line">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-faint">{fieldLabel(key)}</p>
                  {editMode && !Array.isArray(value) ? (
                    <TextInput
                      className="mt-1 py-1.5 text-sm"
                      value={value === null ? "" : String(value)}
                      placeholder="Не найдено"
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                    />
                  ) : (
                    <p
                      className={`mt-0.5 truncate text-sm font-medium ${
                        value === null ? "italic text-ink-faint" : "text-ink"
                      }`}
                    >
                      {displayFieldValue(key, value)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(result.warnings.length > 0 || previewDiscrepancies.length > 0) && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-risk">
                Предупреждения
              </p>
              <div className="flex flex-col gap-2">
                {result.warnings.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-start gap-2.5 rounded-lg border border-warn/20 bg-warn-soft px-3.5 py-2.5 text-sm text-warn"
                  >
                    <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))}
                {previewDiscrepancies.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start gap-2.5 rounded-lg border border-risk/20 bg-risk-soft px-3.5 py-2.5 text-sm text-risk"
                  >
                    <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Обнаружено расхождение: {d.field}</p>
                      <p className="mt-0.5 text-ink-soft">
                        {d.sourceA}: <span className="font-data text-ink">{d.valueA}</span>
                        {"  ·  "}
                        {d.sourceB}: <span className="font-data text-ink">{d.valueB}</span>
                      </p>
                      <p className="mt-1 text-xs text-ink-faint">
                        Требуется проверка консультанта — расхождение не считается ошибкой автоматически.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {creditLines.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                <Wallet size={13} />
                Обнаруженные кредиты ({creditLines.length})
              </p>
              <div className="flex flex-col gap-2">
                {creditLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-sm"
                  >
                    <span className="font-medium text-ink">
                      {[line.creditor, line.type].filter(Boolean).join(" — ") || "Кредит"}
                    </span>
                    <span className="text-ink-soft">
                      {line.monthlyPayment !== null ? formatTenge(line.monthlyPayment) : "—"}/мес
                      {line.remainingBalance !== null &&
                        ` · остаток ${formatTenge(line.remainingBalance)}`}
                      {line.overdue && (
                        <span className="ml-1.5 font-medium text-risk">просрочка</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <label className="mt-3 flex items-start gap-2.5 rounded-lg border border-navy/15 bg-navy-soft px-3.5 py-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={applyCreditsToClient}
                  onChange={(e) => setApplyCreditsToClient(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line-strong"
                />
                <span>
                  Заполнить «Текущие кредиты» клиента этими данными вместо ручного ввода
                  <span className="block text-xs text-ink-faint">
                    Заменит список текущих кредитов клиента и пересчитает суммарный
                    ежемесячный платёж.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={onRetry}
            disabled={isRetrying}
            className="order-3 sm:order-1"
          >
            {isRetrying ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RotateCcw size={15} />
            )}
            Повторить анализ
          </Button>
          <Button
            variant="secondary"
            onClick={() => setEditMode((v) => !v)}
            className="order-2"
          >
            <Pencil size={15} />
            {editMode ? "Готово" : "Исправить"}
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(editedFields, creditLines.length > 0 && applyCreditsToClient)}
            className="order-1 sm:order-3"
          >
            Подтвердить данные
          </Button>
        </div>
      </div>
    </div>
  );
}
