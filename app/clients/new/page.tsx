"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import { clientService } from "@/lib/services/clientService";
import { documentService } from "@/lib/services/documentService";
import { caseService } from "@/lib/services/caseService";
import { timelineService } from "@/lib/services/timelineService";
import { findDiscrepancies } from "@/lib/matching";
import { mapCreditsToExistingLoans, sumMonthlyPayments } from "@/lib/creditHistory";
import { formatTenge } from "@/lib/format";
import {
  Client,
  MARITAL_STATUS_LABELS,
  MaritalStatus,
  NewClientInput,
} from "@/types/client";
import { DocumentType, ExtractedFields } from "@/types/document";
import { Card, CardHeader } from "@/components/ui/Card";
import { FieldWrapper, SelectInput, TextInput } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// ---------------------------------------------------------------------------
// Загрузка + AI-анализ одного документа ДО того, как клиент создан (у нас ещё
// нет clientId/caseId, поэтому идём напрямую в /api/ai/analyze-document, а не
// через documentService/aiService, которые привязаны к сущностям).
// ---------------------------------------------------------------------------

interface DocSlot {
  file: File | null;
  status: "idle" | "analyzing" | "done" | "error";
  fields: ExtractedFields | null;
  error: string | null;
}

const EMPTY_SLOT: DocSlot = { file: null, status: "idle", fields: null, error: null };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Не удалось прочитать файл."));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

async function analyzeFile(documentType: DocumentType, file: File): Promise<ExtractedFields> {
  const base64Data = await fileToBase64(file);
  let response: Response;
  try {
    response = await fetch("/api/ai/analyze-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Data,
      }),
    });
  } catch {
    throw new Error("Не удалось связаться с сервером анализа. Проверьте соединение.");
  }
  let payload: { result?: { fields?: ExtractedFields }; error?: string } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.result) {
    throw new Error(payload?.error ?? "Не удалось проанализировать документ.");
  }
  return payload.result.fields ?? {};
}

// Пытается привести дату из документа к формату YYYY-MM-DD для <input type="date">.
// Если распознать не удалось — не выдумываем, оставляем пусто (консультант впишет сам).
function tryNormalizeDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dotted = trimmed.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
  return "";
}

function asFieldString(value: ExtractedFields[string] | undefined): string {
  return typeof value === "string" ? value : "";
}

function asFieldNumber(value: ExtractedFields[string] | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ---------------------------------------------------------------------------

type FormState = {
  phone: string;
  city: string;
  maritalStatus: MaritalStatus;
  childrenCount: string;
  fullNameManual: string;
  birthDateManual: string;
  spouseIncome: string;
  propertyValue: string;
  downPayment: string;
  requiredLoanAmount: string;
};

const INITIAL_FORM: FormState = {
  phone: "",
  city: "",
  maritalStatus: "single",
  childrenCount: "0",
  fullNameManual: "",
  birthDateManual: "",
  spouseIncome: "0",
  propertyValue: "",
  downPayment: "",
  requiredLoanAmount: "",
};

const STEP_TITLES = [
  "Удостоверение и личные данные",
  "Доход",
  "Параметры сделки",
  "Кредитная история",
  "Проверка и сохранение",
];

export default function NewClientPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const [identity, setIdentity] = useState<DocSlot>(EMPTY_SLOT);
  const [pension, setPension] = useState<DocSlot>(EMPTY_SLOT);
  const [credit, setCredit] = useState<DocSlot>(EMPTY_SLOT);

  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const identityInputRef = useRef<HTMLInputElement>(null);
  const pensionInputRef = useRef<HTMLInputElement>(null);
  const creditInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Общая логика загрузки + анализа одного слота документа.
  async function handlePick(
    documentType: DocumentType,
    file: File,
    setSlot: (slot: DocSlot) => void
  ) {
    setSlot({ file, status: "analyzing", fields: null, error: null });
    try {
      const fields = await analyzeFile(documentType, file);
      setSlot({ file, status: "done", fields, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось проанализировать документ.";
      setSlot({ file, status: "error", fields: null, error: message });
    }
  }

  // --- Производные значения ------------------------------------------------

  const resolvedFullName =
    form.fullNameManual.trim() || asFieldString(identity.fields?.fullName).trim();
  const resolvedBirthDate =
    form.birthDateManual || tryNormalizeDate(asFieldString(identity.fields?.birthDate));

  const lastContribution = asFieldNumber(pension.fields?.lastContributionAmount);
  const computedIncome = lastContribution !== null ? lastContribution * 10 : 0;

  const creditLines = Array.isArray(credit.fields?.credits)
    ? (credit.fields!.credits as unknown as Parameters<typeof mapCreditsToExistingLoans>[0])
    : [];
  const existingLoans = creditLines.length > 0 ? mapCreditsToExistingLoans(creditLines) : [];
  const estimatedMonthlyPayments = sumMonthlyPayments(existingLoans);

  // --- Навигация -------------------------------------------------------------

  function goNext() {
    setStepError(null);
    if (step === 1) {
      if (!identity.file) {
        setStepError("Загрузите скан удостоверения личности.");
        return;
      }
      if (!form.phone.trim() || !form.city.trim()) {
        setStepError("Заполните телефон и город.");
        return;
      }
      if (!resolvedFullName || !resolvedBirthDate) {
        setStepError(
          "Не удалось распознать ФИО и/или дату рождения из документа — заполните их вручную ниже."
        );
        return;
      }
    }
    if (step === 2) {
      if (!pension.file) {
        setStepError("Загрузите выписку о пенсионных отчислениях.");
        return;
      }
      if (computedIncome <= 0) {
        setStepError(
          "Не удалось рассчитать доход по выписке — проверьте файл или дождитесь окончания анализа."
        );
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  }

  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function persistDoc(
    clientId: string,
    caseId: string,
    documentType: DocumentType,
    slot: DocSlot,
    client: Client
  ) {
    if (!slot.file || !slot.fields) return;
    const doc = await documentService.upload({
      clientId,
      caseId,
      type: documentType,
      fileName: slot.file.name,
      fileSizeBytes: slot.file.size,
    });
    await documentService.setAnalysisResult(doc.id, {
      documentType,
      fields: slot.fields,
      warnings: [],
      analyzedAt: new Date().toISOString(),
    });
    // Подтверждаем сразу — отдельный шаг ручного подтверждения консультантом
    // здесь не требуется (документ уже проверен на этапе создания клиента).
    await documentService.confirm(doc.id, slot.fields);

    const discrepancies = findDiscrepancies(client, documentType, slot.fields);
    for (const discrepancy of discrepancies) {
      await caseService.addDiscrepancy(caseId, discrepancy);
    }

    await timelineService.addEvent(
      caseId,
      documentType === "credit_history" ? "client_credits_synced" : "document_analyzed",
      `${
        documentType === "identity"
          ? "Удостоверение личности"
          : documentType === "pension_contributions"
            ? "Пенсионные отчисления"
            : "Кредитная история"
      } загружены и подтверждены при создании клиента`
    );
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const input: NewClientInput = {
        fullName: resolvedFullName,
        phone: form.phone.trim(),
        birthDate: resolvedBirthDate,
        city: form.city.trim(),
        maritalStatus: form.maritalStatus,
        childrenCount: Number(form.childrenCount) || 0,
        estimatedIncome: computedIncome,
        spouseIncome: Number(form.spouseIncome) || 0,
        propertyValue: Number(form.propertyValue) || 0,
        downPayment: Number(form.downPayment) || 0,
        requiredLoanAmount: Number(form.requiredLoanAmount) || 0,
        existingLoans,
        estimatedMonthlyPayments,
      };

      const { client, mortgageCase } = await clientService.create(input);

      await persistDoc(client.id, mortgageCase.id, "identity", identity, client);
      await persistDoc(client.id, mortgageCase.id, "pension_contributions", pension, client);
      await persistDoc(client.id, mortgageCase.id, "credit_history", credit, client);

      router.push(`/clients/${client.id}`);
    } catch (err) {
      console.error(err);
      setSaveError("Не удалось создать клиента. Попробуйте ещё раз.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Первичная консультация
        </p>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Новый клиент</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Загрузите документы клиента — AI извлечёт данные автоматически. После сохранения
          создаётся ипотечное дело на этапе «Консультация».
        </p>
      </div>

      {/* Индикатор шагов */}
      <div className="flex flex-wrap items-center gap-2">
        {STEP_TITLES.map((title, idx) => {
          const n = idx + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div
              key={title}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                active
                  ? "border-navy bg-navy-soft text-navy"
                  : done
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-line text-ink-faint"
              }`}
            >
              {done ? <CheckCircle2 size={13} /> : <span>{n}</span>}
              <span className="hidden sm:inline">{title}</span>
            </div>
          );
        })}
      </div>

      {/* Шаг 1 */}
      {step === 1 && (
        <Card>
          <CardHeader eyebrow="Шаг 1" title="Удостоверение и личные данные" />
          <div className="flex flex-col gap-5 p-5">
            <DocUploadRow
              label="Удостоверение личности"
              hint="AI распознает ФИО, дату рождения и ИИН. Их можно поправить вручную ниже."
              slot={identity}
              inputRef={identityInputRef}
              onPick={(file) => handlePick("identity", file, setIdentity)}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldWrapper label="Телефон" htmlFor="phone" required>
                <TextInput
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+7 700 000 00 00"
                  required
                />
              </FieldWrapper>
              <FieldWrapper label="Город" htmlFor="city" required>
                <TextInput
                  id="city"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Например, Алматы"
                  required
                />
              </FieldWrapper>
              <FieldWrapper label="Семейное положение" htmlFor="maritalStatus">
                <SelectInput
                  id="maritalStatus"
                  value={form.maritalStatus}
                  onChange={(e) => update("maritalStatus", e.target.value as MaritalStatus)}
                >
                  {Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              </FieldWrapper>
              <FieldWrapper label="Количество детей" htmlFor="childrenCount">
                <TextInput
                  id="childrenCount"
                  type="number"
                  min={0}
                  value={form.childrenCount}
                  onChange={(e) => update("childrenCount", e.target.value)}
                />
              </FieldWrapper>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-lg border border-dashed border-line-strong p-4 sm:grid-cols-2">
              <FieldWrapper
                label="ФИО"
                htmlFor="fullNameManual"
                hint={
                  identity.fields?.fullName
                    ? `Распознано из документа: ${asFieldString(identity.fields.fullName)}`
                    : "Заполните вручную, если AI не распознал документ"
                }
              >
                <TextInput
                  id="fullNameManual"
                  value={form.fullNameManual}
                  onChange={(e) => update("fullNameManual", e.target.value)}
                  placeholder={asFieldString(identity.fields?.fullName) || "Асель Нурлановна Жумабекова"}
                />
              </FieldWrapper>
              <FieldWrapper
                label="Дата рождения"
                htmlFor="birthDateManual"
                hint={
                  identity.fields?.birthDate
                    ? `Распознано из документа: ${asFieldString(identity.fields.birthDate)}`
                    : "Заполните вручную, если AI не распознал документ"
                }
              >
                <TextInput
                  id="birthDateManual"
                  type="date"
                  value={form.birthDateManual}
                  onChange={(e) => update("birthDateManual", e.target.value)}
                />
              </FieldWrapper>
            </div>
          </div>
        </Card>
      )}

      {/* Шаг 2 */}
      {step === 2 && (
        <Card>
          <CardHeader eyebrow="Шаг 2" title="Доход" />
          <div className="flex flex-col gap-5 p-5">
            <DocUploadRow
              label="Пенсионные отчисления (ЕНПФ)"
              hint="Доход рассчитывается автоматически как последнее отчисление × 10 (ОПВ — 10% от зарплаты)."
              slot={pension}
              inputRef={pensionInputRef}
              onPick={(file) => handlePick("pension_contributions", file, setPension)}
            />

            {pension.status === "done" && (
              <div className="rounded-lg border border-success/20 bg-success-soft px-4 py-3">
                <p className="text-xs text-ink-faint">Расчётный доход клиента</p>
                <p className="mt-0.5 font-data text-lg font-medium text-success">
                  {formatTenge(computedIncome)}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Последнее отчисление:{" "}
                  {formatTenge(asFieldNumber(pension.fields?.lastContributionAmount) ?? 0)}
                  {pension.fields?.lastContributionPeriod
                    ? ` · ${asFieldString(pension.fields.lastContributionPeriod)}`
                    : ""}
                </p>
              </div>
            )}

            <div className="max-w-xs">
              <FieldWrapper
                label="Доход супруга/супруги, ₸/мес"
                htmlFor="spouseIncome"
                hint="Со слов клиента на консультации"
              >
                <TextInput
                  id="spouseIncome"
                  type="number"
                  min={0}
                  value={form.spouseIncome}
                  onChange={(e) => update("spouseIncome", e.target.value)}
                  placeholder="0"
                />
              </FieldWrapper>
            </div>
          </div>
        </Card>
      )}

      {/* Шаг 3 — без изменений */}
      {step === 3 && (
        <Card>
          <CardHeader eyebrow="Шаг 3" title="Параметры сделки" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            <FieldWrapper label="Стоимость недвижимости, ₸" htmlFor="propertyValue">
              <TextInput
                id="propertyValue"
                type="number"
                min={0}
                value={form.propertyValue}
                onChange={(e) => update("propertyValue", e.target.value)}
                placeholder="32000000"
              />
            </FieldWrapper>
            <FieldWrapper label="Первоначальный взнос, ₸" htmlFor="downPayment">
              <TextInput
                id="downPayment"
                type="number"
                min={0}
                value={form.downPayment}
                onChange={(e) => update("downPayment", e.target.value)}
                placeholder="6400000"
              />
            </FieldWrapper>
            <FieldWrapper label="Необходимая сумма ипотеки, ₸" htmlFor="requiredLoanAmount">
              <TextInput
                id="requiredLoanAmount"
                type="number"
                min={0}
                value={form.requiredLoanAmount}
                onChange={(e) => update("requiredLoanAmount", e.target.value)}
                placeholder="25600000"
              />
            </FieldWrapper>
          </div>
        </Card>
      )}

      {/* Шаг 4 */}
      {step === 4 && (
        <Card>
          <CardHeader eyebrow="Шаг 4" title="Кредитная история" />
          <div className="flex flex-col gap-5 p-5">
            <DocUploadRow
              label="Кредитная история"
              hint="Необязательно. AI распознает действующие кредиты и заполнит их автоматически — подтверждать вручную не нужно."
              slot={credit}
              inputRef={creditInputRef}
              onPick={(file) => handlePick("credit_history", file, setCredit)}
            />

            {credit.status === "done" && (
              <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3">
                {existingLoans.length > 0 ? (
                  <>
                    <p className="text-xs text-ink-faint">Распознанные кредиты</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {existingLoans.map((loan) => (
                        <p key={loan.id} className="text-sm text-ink">
                          {loan.title} — {formatTenge(loan.monthlyPayment)}/мес
                        </p>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-ink-faint">
                      Суммарный платёж: {formatTenge(estimatedMonthlyPayments)}/мес
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-ink-soft">Действующих кредитов не найдено.</p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Шаг 5 — проверка и сохранение */}
      {step === 5 && (
        <Card>
          <CardHeader eyebrow="Шаг 5" title="Проверка перед сохранением" />
          <div className="flex flex-col gap-5 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SummaryField label="ФИО" value={resolvedFullName || "—"} />
              <SummaryField label="Дата рождения" value={resolvedBirthDate || "—"} />
              <SummaryField label="Телефон" value={form.phone} />
              <SummaryField label="Город" value={form.city} />
              <SummaryField label="Семейное положение" value={MARITAL_STATUS_LABELS[form.maritalStatus]} />
              <SummaryField label="Детей" value={form.childrenCount || "0"} />
              <SummaryField label="Доход клиента (расчётно)" value={formatTenge(computedIncome)} />
              <SummaryField label="Доход супруга" value={formatTenge(Number(form.spouseIncome) || 0)} />
              <SummaryField label="Стоимость недвижимости" value={formatTenge(Number(form.propertyValue) || 0)} />
              <SummaryField label="Первоначальный взнос" value={formatTenge(Number(form.downPayment) || 0)} />
              <SummaryField label="Необходимая ипотека" value={formatTenge(Number(form.requiredLoanAmount) || 0)} />
              <SummaryField
                label="Текущие кредиты"
                value={
                  existingLoans.length > 0
                    ? `${existingLoans.length} шт · ${formatTenge(estimatedMonthlyPayments)}/мес`
                    : "Нет"
                }
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Документы для дела
              </p>
              <DocSummaryRow label="Удостоверение личности" slot={identity} />
              <DocSummaryRow label="Пенсионные отчисления" slot={pension} />
              <DocSummaryRow label="Кредитная история" slot={credit} />
            </div>

            {saveError && (
              <div className="rounded-lg border border-risk/20 bg-risk-soft px-4 py-3 text-sm text-risk">
                {saveError}
              </div>
            )}
          </div>
        </Card>
      )}

      {stepError && (
        <div className="flex items-start gap-2 rounded-lg border border-risk/20 bg-risk-soft px-4 py-3 text-sm text-risk">
          <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {stepError}
        </div>
      )}

      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => (step === 1 ? router.push("/clients") : goBack())}
        >
          <ArrowLeft size={16} />
          {step === 1 ? "Отмена" : "Назад"}
        </Button>

        {step < 5 ? (
          <Button type="button" onClick={goNext}>
            Далее
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button type="button" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? "Сохранение…" : "Сохранить клиента"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Вспомогательные UI-блоки
// ---------------------------------------------------------------------------

function DocUploadRow({
  label,
  hint,
  slot,
  inputRef,
  onPick,
}: {
  label: string;
  hint: string;
  slot: DocSlot;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-line px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-ink-soft">
            <FileText size={16} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{label}</p>
            <p className="mt-0.5 truncate text-xs text-ink-faint">
              {slot.file ? slot.file.name : hint}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {slot.status === "analyzing" && (
            <Badge tone="navy">
              <Loader2 size={12} className="animate-spin" /> Анализируется
            </Badge>
          )}
          {slot.status === "done" && <Badge tone="success"><CheckCircle2 size={12} /> Распознано</Badge>}
          {slot.status === "error" && <Badge tone="risk">Ошибка анализа</Badge>}

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(file);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            disabled={slot.status === "analyzing"}
            onClick={() => inputRef.current?.click()}
          >
            {slot.status === "analyzing" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {slot.file ? "Заменить файл" : "Загрузить файл"}
          </Button>
        </div>
      </div>

      {slot.status === "error" && (
        <div className="flex flex-wrap items-start gap-2.5 rounded-lg border border-risk/20 bg-risk-soft px-3.5 py-2.5 text-sm text-risk">
          <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Не удалось проанализировать документ.</p>
            {slot.error && <p className="mt-0.5 text-xs text-risk/80">{slot.error}</p>}
            {slot.file && (
              <Button
                type="button"
                variant="ghost"
                className="mt-1.5 px-2 py-1 text-xs"
                onClick={() => inputRef.current?.click()}
              >
                <Sparkles size={13} />
                Повторить анализ
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm text-ink">{value}</p>
    </div>
  );
}

function DocSummaryRow({ label, slot }: { label: string; slot: DocSlot }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-soft">{label}</span>
      {!slot.file ? (
        <Badge tone="neutral">Не загружен</Badge>
      ) : slot.status === "done" ? (
        <Badge tone="success">
          <CheckCircle2 size={12} /> {slot.file.name}
        </Badge>
      ) : slot.status === "analyzing" ? (
        <Badge tone="navy">
          <Loader2 size={12} className="animate-spin" /> Анализируется
        </Badge>
      ) : (
        <Badge tone="risk">Ошибка анализа — не будет сохранён</Badge>
      )}
    </div>
  );
}
