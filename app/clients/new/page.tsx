"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Save } from "lucide-react";
import { clientService } from "@/lib/services/clientService";
import { MARITAL_STATUS_LABELS, MaritalStatus, NewClientInput } from "@/types/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { FieldWrapper, SelectInput, TextInput } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

type FormState = {
  fullName: string;
  phone: string;
  birthDate: string;
  city: string;
  maritalStatus: MaritalStatus;
  childrenCount: string;
  estimatedIncome: string;
  spouseIncome: string;
  propertyValue: string;
  downPayment: string;
  requiredLoanAmount: string;
};

const INITIAL_STATE: FormState = {
  fullName: "",
  phone: "",
  birthDate: "",
  city: "",
  maritalStatus: "single",
  childrenCount: "0",
  estimatedIncome: "",
  spouseIncome: "0",
  propertyValue: "",
  downPayment: "",
  requiredLoanAmount: "",
};

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.fullName.trim() || !form.phone.trim() || !form.birthDate || !form.city.trim()) {
      setError("Заполните обязательные поля: ФИО, телефон, дата рождения, город.");
      return;
    }

    setSubmitting(true);
    try {
      const input: NewClientInput = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        birthDate: form.birthDate,
        city: form.city.trim(),
        maritalStatus: form.maritalStatus,
        childrenCount: Number(form.childrenCount) || 0,
        estimatedIncome: Number(form.estimatedIncome) || 0,
        spouseIncome: Number(form.spouseIncome) || 0,
        propertyValue: Number(form.propertyValue) || 0,
        downPayment: Number(form.downPayment) || 0,
        requiredLoanAmount: Number(form.requiredLoanAmount) || 0,
        // Текущие кредиты больше не вводятся вручную на этом шаге — они
        // автоматически подтягиваются из кредитной истории (PDF) после
        // создания клиента, см. components/documents/DocumentAnalysisModal.tsx
        // и lib/creditHistory.ts. Здесь фиксируем пустое состояние.
        existingLoans: [],
        estimatedMonthlyPayments: 0,
      };

      const { client } = await clientService.create(input);
      router.push(`/clients/${client.id}`);
    } catch (err) {
      console.error(err);
      setError("Не удалось создать клиента. Попробуйте ещё раз.");
      setSubmitting(false);
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
          Данные, зафиксированные на консультации. После сохранения автоматически создаётся
          ипотечное дело на этапе «Консультация».
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader eyebrow="Шаг 1" title="Личные данные" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FieldWrapper label="ФИО" htmlFor="fullName" required>
              <TextInput
                id="fullName"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Например, Асель Нурлановна Жумабекова"
                required
              />
            </FieldWrapper>
            <FieldWrapper label="Телефон" htmlFor="phone" required>
              <TextInput
                id="phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+7 700 000 00 00"
                required
              />
            </FieldWrapper>
            <FieldWrapper label="Дата рождения" htmlFor="birthDate" required>
              <TextInput
                id="birthDate"
                type="date"
                value={form.birthDate}
                onChange={(e) => update("birthDate", e.target.value)}
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
        </Card>

        <Card>
          <CardHeader eyebrow="Шаг 2" title="Доход" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FieldWrapper label="Примерный доход клиента, ₸/мес" htmlFor="estimatedIncome" hint="Со слов клиента на консультации">
              <TextInput
                id="estimatedIncome"
                type="number"
                min={0}
                value={form.estimatedIncome}
                onChange={(e) => update("estimatedIncome", e.target.value)}
                placeholder="700000"
              />
            </FieldWrapper>
            <FieldWrapper label="Доход супруга/супруги, ₸/мес" htmlFor="spouseIncome">
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
        </Card>

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

        <Card>
          <CardHeader eyebrow="Шаг 4" title="Текущие кредиты" />
          <div className="flex items-start gap-3 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-soft text-navy">
              <FileText size={16} strokeWidth={1.75} />
            </span>
            <p className="text-sm text-ink-soft">
              Ручной ввод кредитов здесь больше не требуется. После создания клиента
              загрузите его кредитную историю (PDF) в карточке дела — система сама
              распознает все действующие кредиты и заполнит этот раздел.
            </p>
          </div>
        </Card>

        {error && (
          <div className="rounded-lg border border-risk/20 bg-risk-soft px-4 py-3 text-sm text-risk">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.push("/clients")}>
            Отмена
          </Button>
          <Button type="submit" disabled={submitting}>
            <Save size={16} />
            {submitting ? "Сохранение…" : "Сохранить клиента"}
          </Button>
        </div>
      </form>
    </div>
  );
}
