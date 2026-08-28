"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { bankService, programService } from "@/lib/services/bankService";
import {
  Bank,
  MortgageProgram,
  PROGRAM_CATEGORY_LABELS,
  ProgramCategory,
} from "@/types/bank";
import { MARITAL_STATUS_LABELS, MaritalStatus as BankMaritalStatus } from "@/types/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, SelectInput, TextArea, TextInput } from "@/components/ui/FormField";
import { formatTenge } from "@/lib/format";

type ProgramFormState = {
  name: string;
  category: ProgramCategory;
  active: boolean;
  interestRatePercent: string;
  maxTermYears: string;
  minDownPaymentPercent: string;
  minLoanAmount: string;
  maxLoanAmount: string;
  minHouseholdIncome: string;
  maxDebtToIncomeRatio: string;
  minBorrowerAge: string;
  maxBorrowerAge: string;
  minChildrenCount: string;
  eligibleMaritalStatuses: BankMaritalStatus[];
  allowedCities: string;
  notes: string;
};

function emptyProgramForm(): ProgramFormState {
  return {
    name: "",
    category: "market",
    active: true,
    interestRatePercent: "",
    maxTermYears: "20",
    minDownPaymentPercent: "10",
    minLoanAmount: "",
    maxLoanAmount: "",
    minHouseholdIncome: "",
    maxDebtToIncomeRatio: "50",
    minBorrowerAge: "",
    maxBorrowerAge: "",
    minChildrenCount: "",
    eligibleMaritalStatuses: [],
    allowedCities: "",
    notes: "",
  };
}

function programToForm(p: MortgageProgram): ProgramFormState {
  return {
    name: p.name,
    category: p.category,
    active: p.active,
    interestRatePercent: String(p.interestRatePercent),
    maxTermYears: String(p.maxTermYears),
    minDownPaymentPercent: String(p.minDownPaymentPercent),
    minLoanAmount: p.minLoanAmount !== undefined ? String(p.minLoanAmount) : "",
    maxLoanAmount: p.maxLoanAmount !== undefined ? String(p.maxLoanAmount) : "",
    minHouseholdIncome: p.minHouseholdIncome !== undefined ? String(p.minHouseholdIncome) : "",
    maxDebtToIncomeRatio: p.maxDebtToIncomeRatio !== undefined ? String(p.maxDebtToIncomeRatio) : "",
    minBorrowerAge: p.minBorrowerAge !== undefined ? String(p.minBorrowerAge) : "",
    maxBorrowerAge: p.maxBorrowerAge !== undefined ? String(p.maxBorrowerAge) : "",
    minChildrenCount: p.minChildrenCount !== undefined ? String(p.minChildrenCount) : "",
    eligibleMaritalStatuses: p.eligibleMaritalStatuses ?? [],
    allowedCities: (p.allowedCities ?? []).join(", "),
    notes: p.notes ?? "",
  };
}

function formToProgramPatch(form: ProgramFormState, bankId: string) {
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  return {
    bankId,
    name: form.name.trim(),
    category: form.category,
    active: form.active,
    interestRatePercent: Number(form.interestRatePercent) || 0,
    maxTermYears: Number(form.maxTermYears) || 0,
    minDownPaymentPercent: Number(form.minDownPaymentPercent) || 0,
    minLoanAmount: num(form.minLoanAmount),
    maxLoanAmount: num(form.maxLoanAmount),
    minHouseholdIncome: num(form.minHouseholdIncome),
    maxDebtToIncomeRatio: num(form.maxDebtToIncomeRatio),
    minBorrowerAge: num(form.minBorrowerAge),
    maxBorrowerAge: num(form.maxBorrowerAge),
    minChildrenCount: num(form.minChildrenCount),
    eligibleMaritalStatuses:
      form.eligibleMaritalStatuses.length > 0 ? form.eligibleMaritalStatuses : undefined,
    allowedCities:
      form.allowedCities.trim().length > 0
        ? form.allowedCities.split(",").map((c) => c.trim()).filter(Boolean)
        : undefined,
    notes: form.notes.trim() || undefined,
  };
}

export default function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [programs, setPrograms] = useState<MortgageProgram[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newBankNote, setNewBankNote] = useState("");

  const [addingProgramFor, setAddingProgramFor] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState<ProgramFormState>(emptyProgramForm());
  const [programFormError, setProgramFormError] = useState<string | null>(null);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [b, p] = await Promise.all([bankService.getAll(), programService.getAll()]);
    setBanks(b);
    setPrograms(p);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [b, p] = await Promise.all([bankService.getAll(), programService.getAll()]);
      if (cancelled) return;
      setBanks(b);
      setPrograms(p);
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddBank() {
    if (!newBankName.trim()) return;
    await bankService.create({ name: newBankName.trim(), note: newBankNote.trim() || undefined });
    setNewBankName("");
    setNewBankNote("");
    setShowAddBank(false);
    await reload();
  }

  async function handleDeleteBank(id: string) {
    await bankService.remove(id);
    await reload();
  }

  function startAddProgram(bankId: string) {
    setAddingProgramFor(bankId);
    setEditingProgramId(null);
    setProgramForm(emptyProgramForm());
    setProgramFormError(null);
  }

  function startEditProgram(program: MortgageProgram) {
    setAddingProgramFor(program.bankId);
    setEditingProgramId(program.id);
    setProgramForm(programToForm(program));
    setProgramFormError(null);
  }

  function validateProgramForm(form: ProgramFormState): string | null {
    if (!form.name.trim()) return "Укажите название программы.";
    if (!form.interestRatePercent.trim() || Number(form.interestRatePercent) < 0)
      return "Укажите корректную ставку.";
    if (!form.maxTermYears.trim() || Number(form.maxTermYears) <= 0)
      return "Укажите корректный максимальный срок.";
    if (!form.minDownPaymentPercent.trim() || Number(form.minDownPaymentPercent) < 0)
      return "Укажите корректный минимальный первоначальный взнос.";
    return null;
  }

  async function handleSaveProgram(bankId: string) {
    const error = validateProgramForm(programForm);
    if (error) {
      setProgramFormError(error);
      return;
    }
    const patch = formToProgramPatch(programForm, bankId);
    if (editingProgramId) {
      await programService.update(editingProgramId, patch);
    } else {
      await programService.create(patch);
    }
    setAddingProgramFor(null);
    setEditingProgramId(null);
    await reload();
  }

  async function handleDeleteProgram(id: string) {
    await programService.remove(id);
    await reload();
  }

  function toggleMaritalStatus(status: BankMaritalStatus) {
    setProgramForm((f) => ({
      ...f,
      eligibleMaritalStatuses: f.eligibleMaritalStatuses.includes(status)
        ? f.eligibleMaritalStatuses.filter((s) => s !== status)
        : [...f.eligibleMaritalStatuses, status],
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Справочник
        </p>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Банки и программы</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Условия программ, по которым CRM подбирает варианты для клиентов (карточка клиента →
          «Банки и программы»). Незаполненный критерий не ограничивает подбор.
        </p>
      </div>

      {loaded && banks.length === 0 && !showAddBank && (
        <p className="text-sm text-ink-soft">Банков пока нет — добавьте первый.</p>
      )}

      <div className="flex flex-col gap-5">
        {banks.map((bank) => {
          const bankPrograms = programs.filter((p) => p.bankId === bank.id);
          return (
            <Card key={bank.id}>
              <CardHeader
                eyebrow="Банк"
                title={
                  <span className="inline-flex items-center gap-2">
                    <Landmark size={17} className="text-navy" /> {bank.name}
                  </span>
                }
                action={
                  <Button
                    variant="ghost"
                    className="px-2.5 py-1.5 text-risk hover:bg-risk-soft"
                    onClick={() => handleDeleteBank(bank.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                }
              />
              <div className="flex flex-col gap-3 p-5">
                {bank.note && <p className="text-sm text-ink-soft">{bank.note}</p>}

                {bankPrograms.length === 0 && addingProgramFor !== bank.id && (
                  <p className="text-sm text-ink-soft">Программ пока нет.</p>
                )}

                {bankPrograms.map((program) => (
                  <div
                    key={program.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line px-4 py-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-ink">{program.name}</p>
                        <Badge tone="navy">{PROGRAM_CATEGORY_LABELS[program.category]}</Badge>
                        {!program.active && <Badge tone="neutral">Отключена</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-ink-faint">
                        Ставка {program.interestRatePercent}% · до {program.maxTermYears} лет · ПВ от{" "}
                        {program.minDownPaymentPercent}%
                        {program.minHouseholdIncome
                          ? ` · доход от ${formatTenge(program.minHouseholdIncome)}`
                          : ""}
                        {program.maxDebtToIncomeRatio ? ` · нагрузка до ${program.maxDebtToIncomeRatio}%` : ""}
                      </p>
                      {program.notes && (
                        <p className="mt-1 text-xs text-ink-faint">{program.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="ghost"
                        className="px-2.5 py-1.5"
                        onClick={() => startEditProgram(program)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2.5 py-1.5 text-risk hover:bg-risk-soft"
                        onClick={() => handleDeleteProgram(program.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}

                {addingProgramFor === bank.id ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-line-strong p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FieldWrapper label="Название программы" htmlFor="p-name" required>
                        <TextInput
                          id="p-name"
                          value={programForm.name}
                          onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="7-20-25"
                        />
                      </FieldWrapper>
                      <FieldWrapper label="Категория" htmlFor="p-category">
                        <SelectInput
                          id="p-category"
                          value={programForm.category}
                          onChange={(e) =>
                            setProgramForm((f) => ({ ...f, category: e.target.value as ProgramCategory }))
                          }
                        >
                          {Object.entries(PROGRAM_CATEGORY_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </SelectInput>
                      </FieldWrapper>
                      <FieldWrapper label="Статус" htmlFor="p-active">
                        <SelectInput
                          id="p-active"
                          value={programForm.active ? "1" : "0"}
                          onChange={(e) =>
                            setProgramForm((f) => ({ ...f, active: e.target.value === "1" }))
                          }
                        >
                          <option value="1">Активна</option>
                          <option value="0">Отключена</option>
                        </SelectInput>
                      </FieldWrapper>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <FieldWrapper label="Ставка, %" htmlFor="p-rate" required>
                        <TextInput
                          id="p-rate"
                          type="number"
                          min={0}
                          step="0.1"
                          value={programForm.interestRatePercent}
                          onChange={(e) =>
                            setProgramForm((f) => ({ ...f, interestRatePercent: e.target.value }))
                          }
                        />
                      </FieldWrapper>
                      <FieldWrapper label="Срок, лет" htmlFor="p-term" required>
                        <TextInput
                          id="p-term"
                          type="number"
                          min={1}
                          value={programForm.maxTermYears}
                          onChange={(e) => setProgramForm((f) => ({ ...f, maxTermYears: e.target.value }))}
                        />
                      </FieldWrapper>
                      <FieldWrapper label="Мин. ПВ, %" htmlFor="p-downpayment" required>
                        <TextInput
                          id="p-downpayment"
                          type="number"
                          min={0}
                          value={programForm.minDownPaymentPercent}
                          onChange={(e) =>
                            setProgramForm((f) => ({ ...f, minDownPaymentPercent: e.target.value }))
                          }
                        />
                      </FieldWrapper>
                      <FieldWrapper label="Макс. нагрузка, %" htmlFor="p-dti" hint="платежи/доход">
                        <TextInput
                          id="p-dti"
                          type="number"
                          min={0}
                          value={programForm.maxDebtToIncomeRatio}
                          onChange={(e) =>
                            setProgramForm((f) => ({ ...f, maxDebtToIncomeRatio: e.target.value }))
                          }
                        />
                      </FieldWrapper>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <FieldWrapper label="Мин. сумма, ₸" htmlFor="p-minloan">
                        <TextInput
                          id="p-minloan"
                          type="number"
                          min={0}
                          value={programForm.minLoanAmount}
                          onChange={(e) => setProgramForm((f) => ({ ...f, minLoanAmount: e.target.value }))}
                        />
                      </FieldWrapper>
                      <FieldWrapper label="Макс. сумма, ₸" htmlFor="p-maxloan">
                        <TextInput
                          id="p-maxloan"
                          type="number"
                          min={0}
                          value={programForm.maxLoanAmount}
                          onChange={(e) => setProgramForm((f) => ({ ...f, maxLoanAmount: e.target.value }))}
                        />
                      </FieldWrapper>
                      <FieldWrapper label="Мин. доход семьи, ₸" htmlFor="p-minincome">
                        <TextInput
                          id="p-minincome"
                          type="number"
                          min={0}
                          value={programForm.minHouseholdIncome}
                          onChange={(e) =>
                            setProgramForm((f) => ({ ...f, minHouseholdIncome: e.target.value }))
                          }
                        />
                      </FieldWrapper>
                      <FieldWrapper label="Мин. детей" htmlFor="p-minchildren">
                        <TextInput
                          id="p-minchildren"
                          type="number"
                          min={0}
                          value={programForm.minChildrenCount}
                          onChange={(e) =>
                            setProgramForm((f) => ({ ...f, minChildrenCount: e.target.value }))
                          }
                        />
                      </FieldWrapper>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <FieldWrapper label="Мин. возраст" htmlFor="p-minage">
                        <TextInput
                          id="p-minage"
                          type="number"
                          min={0}
                          value={programForm.minBorrowerAge}
                          onChange={(e) => setProgramForm((f) => ({ ...f, minBorrowerAge: e.target.value }))}
                        />
                      </FieldWrapper>
                      <FieldWrapper label="Макс. возраст" htmlFor="p-maxage">
                        <TextInput
                          id="p-maxage"
                          type="number"
                          min={0}
                          value={programForm.maxBorrowerAge}
                          onChange={(e) => setProgramForm((f) => ({ ...f, maxBorrowerAge: e.target.value }))}
                        />
                      </FieldWrapper>
                      <FieldWrapper
                        label="Города (через запятую)"
                        htmlFor="p-cities"
                        hint="Пусто — без ограничений"
                      >
                        <TextInput
                          id="p-cities"
                          value={programForm.allowedCities}
                          onChange={(e) => setProgramForm((f) => ({ ...f, allowedCities: e.target.value }))}
                          placeholder="Алматы, Астана"
                        />
                      </FieldWrapper>
                    </div>

                    <FieldWrapper label="Семейное положение" htmlFor="p-marital" hint="Пусто — без ограничений">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => {
                          const active = programForm.eligibleMaritalStatuses.includes(
                            value as BankMaritalStatus
                          );
                          return (
                            <button
                              type="button"
                              key={value}
                              onClick={() => toggleMaritalStatus(value as BankMaritalStatus)}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                active
                                  ? "border-navy bg-navy-soft text-navy"
                                  : "border-line text-ink-soft hover:bg-surface-sunken"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </FieldWrapper>

                    <FieldWrapper label="Заметка / условия" htmlFor="p-notes">
                      <TextArea
                        id="p-notes"
                        rows={2}
                        value={programForm.notes}
                        onChange={(e) => setProgramForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </FieldWrapper>

                    {programFormError && <p className="text-xs text-risk">{programFormError}</p>}

                    <div className="flex gap-2">
                      <Button variant="primary" onClick={() => handleSaveProgram(bank.id)}>
                        Сохранить программу
                      </Button>
                      <Button variant="ghost" onClick={() => setAddingProgramFor(null)}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startAddProgram(bank.id)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-sunken p-3 transition-colors hover:border-navy hover:bg-surface"
                  >
                    <Plus size={16} className="text-navy" />
                    <span className="text-xs font-medium text-navy">Добавить программу</span>
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {showAddBank ? (
        <Card>
          <CardHeader eyebrow="Новый банк" title="Добавить банк" />
          <div className="flex flex-col gap-3 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldWrapper label="Название банка" htmlFor="bank-name" required>
                <TextInput
                  id="bank-name"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="Например, Jusan Bank"
                />
              </FieldWrapper>
              <FieldWrapper label="Заметка" htmlFor="bank-note">
                <TextInput
                  id="bank-note"
                  value={newBankNote}
                  onChange={(e) => setNewBankNote(e.target.value)}
                />
              </FieldWrapper>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleAddBank}>
                Сохранить банк
              </Button>
              <Button variant="ghost" onClick={() => setShowAddBank(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setShowAddBank(true)}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-sunken p-4 transition-colors hover:border-navy hover:bg-surface"
        >
          <Plus size={16} className="text-navy" />
          <span className="text-sm font-medium text-navy">Добавить банк</span>
        </button>
      )}
    </div>
  );
}
