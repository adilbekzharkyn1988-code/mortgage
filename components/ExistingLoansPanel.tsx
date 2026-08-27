"use client";

// Ручной fallback для "Текущих кредитов" клиента — на случай, если у
// клиента нет PDF кредитной истории (см. lib/creditHistory.ts — основной
// путь заполнения этого раздела). Добавление/редактирование/удаление
// здесь работает поверх того же поля Client.existingLoans, так что оба
// способа (вручную и из PDF) заполняют один и тот же список, а не два разных.

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Client, ExistingLoan } from "@/types/client";
import { clientService } from "@/lib/services/clientService";
import { sumMonthlyPayments } from "@/lib/creditHistory";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import { formatTenge } from "@/lib/format";

function generateLoanId(): string {
  return `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface LoanFormState {
  title: string;
  monthlyPayment: string;
  remainingAmount: string;
}

function emptyForm(): LoanFormState {
  return { title: "", monthlyPayment: "", remainingAmount: "" };
}

function loanToForm(loan: ExistingLoan): LoanFormState {
  return {
    title: loan.title,
    monthlyPayment: String(loan.monthlyPayment || ""),
    remainingAmount: loan.remainingAmount !== undefined ? String(loan.remainingAmount) : "",
  };
}

export function ExistingLoansPanel({
  client,
  onClientChange,
}: {
  client: Client;
  onClientChange: (client: Client) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<LoanFormState>(emptyForm());
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LoanFormState>(emptyForm());
  const [editError, setEditError] = useState<string | null>(null);

  function validate(form: LoanFormState): string | null {
    if (!form.title.trim()) return "Укажите название кредита.";
    const payment = Number(form.monthlyPayment);
    if (!Number.isFinite(payment) || payment < 0) return "Укажите корректный ежемесячный платёж.";
    return null;
  }

  async function persistLoans(loans: ExistingLoan[]) {
    const updated = await clientService.update(client.id, {
      existingLoans: loans,
      estimatedMonthlyPayments: sumMonthlyPayments(loans),
    });
    if (updated) onClientChange(updated);
  }

  async function handleAddSubmit() {
    const error = validate(addForm);
    if (error) {
      setAddError(error);
      return;
    }
    const loan: ExistingLoan = {
      id: generateLoanId(),
      title: addForm.title.trim(),
      monthlyPayment: Number(addForm.monthlyPayment) || 0,
      remainingAmount: addForm.remainingAmount ? Number(addForm.remainingAmount) || 0 : undefined,
    };
    await persistLoans([...client.existingLoans, loan]);
    setShowAddForm(false);
    setAddForm(emptyForm());
    setAddError(null);
  }

  function startEdit(loan: ExistingLoan) {
    setEditingId(loan.id);
    setEditForm(loanToForm(loan));
    setEditError(null);
  }

  async function handleEditSubmit(loanId: string) {
    const error = validate(editForm);
    if (error) {
      setEditError(error);
      return;
    }
    const updatedLoans = client.existingLoans.map((loan) =>
      loan.id === loanId
        ? {
            ...loan,
            title: editForm.title.trim(),
            monthlyPayment: Number(editForm.monthlyPayment) || 0,
            remainingAmount: editForm.remainingAmount
              ? Number(editForm.remainingAmount) || 0
              : undefined,
          }
        : loan
    );
    await persistLoans(updatedLoans);
    setEditingId(null);
  }

  async function handleDelete(loanId: string) {
    await persistLoans(client.existingLoans.filter((loan) => loan.id !== loanId));
    if (editingId === loanId) setEditingId(null);
  }

  return (
    <Card>
      <CardHeader eyebrow="Карточка клиента" title="Текущие кредиты" />
      <div className="flex flex-col gap-3 p-5">
        {client.existingLoans.length === 0 && !showAddForm && (
          <p className="text-sm text-ink-soft">
            Текущих кредитов не указано. Добавьте их вручную или загрузите кредитную
            историю (PDF) в разделе «Документы» — тогда система заполнит их сама.
          </p>
        )}

        {client.existingLoans.map((loan) =>
          editingId === loan.id ? (
            <div key={loan.id} className="flex flex-col gap-3 rounded-lg border border-line-strong p-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FieldWrapper label="Название кредита" htmlFor={`edit-loan-title-${loan.id}`} required>
                  <TextInput
                    id={`edit-loan-title-${loan.id}`}
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </FieldWrapper>
                <FieldWrapper label="Платёж, ₸/мес" htmlFor={`edit-loan-payment-${loan.id}`} required>
                  <TextInput
                    id={`edit-loan-payment-${loan.id}`}
                    type="number"
                    min={0}
                    value={editForm.monthlyPayment}
                    onChange={(e) => setEditForm((f) => ({ ...f, monthlyPayment: e.target.value }))}
                  />
                </FieldWrapper>
                <FieldWrapper label="Остаток долга, ₸" htmlFor={`edit-loan-remaining-${loan.id}`}>
                  <TextInput
                    id={`edit-loan-remaining-${loan.id}`}
                    type="number"
                    min={0}
                    value={editForm.remainingAmount}
                    onChange={(e) => setEditForm((f) => ({ ...f, remainingAmount: e.target.value }))}
                  />
                </FieldWrapper>
              </div>
              {editError && <p className="text-xs text-risk">{editError}</p>}
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => handleEditSubmit(loan.id)}>
                  Сохранить
                </Button>
                <Button variant="ghost" onClick={() => setEditingId(null)}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <div
              key={loan.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-4 py-3"
            >
              <p className="text-sm font-medium text-ink">{loan.title}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-ink-soft">
                  Платёж: <span className="font-data text-ink">{formatTenge(loan.monthlyPayment)}</span>
                </span>
                {loan.remainingAmount !== undefined && (
                  <span className="text-ink-soft">
                    Остаток: <span className="font-data text-ink">{formatTenge(loan.remainingAmount)}</span>
                  </span>
                )}
                <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => startEdit(loan)}>
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  className="px-2.5 py-1.5 text-risk hover:bg-risk-soft"
                  onClick={() => handleDelete(loan.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          )
        )}

        {client.existingLoans.length > 0 && (
          <p className="text-sm text-ink-soft">
            Суммарный ежемесячный платёж:{" "}
            <Badge tone="navy" className="font-data">
              {formatTenge(client.estimatedMonthlyPayments)}
            </Badge>
          </p>
        )}

        {!showAddForm && (
          <button
            onClick={() => {
              setAddForm(emptyForm());
              setAddError(null);
              setShowAddForm(true);
            }}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-sunken p-3 transition-colors hover:border-navy hover:bg-surface"
          >
            <Plus size={16} className="text-navy" />
            <span className="text-xs font-medium text-navy">Добавить кредит вручную</span>
          </button>
        )}

        {showAddForm && (
          <div className="flex flex-col gap-3 rounded-lg border border-line-strong p-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FieldWrapper label="Название кредита" htmlFor="add-loan-title" required>
                <TextInput
                  id="add-loan-title"
                  value={addForm.title}
                  onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Автокредит"
                />
              </FieldWrapper>
              <FieldWrapper label="Платёж, ₸/мес" htmlFor="add-loan-payment" required>
                <TextInput
                  id="add-loan-payment"
                  type="number"
                  min={0}
                  value={addForm.monthlyPayment}
                  onChange={(e) => setAddForm((f) => ({ ...f, monthlyPayment: e.target.value }))}
                  placeholder="85000"
                />
              </FieldWrapper>
              <FieldWrapper label="Остаток долга, ₸" htmlFor="add-loan-remaining">
                <TextInput
                  id="add-loan-remaining"
                  type="number"
                  min={0}
                  value={addForm.remainingAmount}
                  onChange={(e) => setAddForm((f) => ({ ...f, remainingAmount: e.target.value }))}
                  placeholder="1800000"
                />
              </FieldWrapper>
            </div>
            {addError && <p className="text-xs text-risk">{addError}</p>}
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleAddSubmit}>
                Сохранить
              </Button>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                Отмена
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
