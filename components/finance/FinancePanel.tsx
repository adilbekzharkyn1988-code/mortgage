"use client";

// ЭТАП 5, п.5.5–5.7: финансовый блок и история оплат в карточке ипотечного дела.
// Остаток НИКОГДА не вводится вручную — он вычисляется в lib/finance.ts
// на основе стоимости услуг (из договора) и суммы платежей.

import { useEffect, useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { PAYMENT_METHOD_LABELS, Payment, PaymentMethod } from "@/types/finance";
import { paymentService } from "@/lib/services/paymentService";
import { timelineService } from "@/lib/services/timelineService";
import { calculateFinanceSummary } from "@/lib/finance";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, SelectInput, TextArea, TextInput } from "@/components/ui/FormField";
import { formatDate, formatTenge } from "@/lib/format";

interface PaymentFormState {
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  comment: string;
}

function emptyForm(): PaymentFormState {
  return {
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "transfer",
    comment: "",
  };
}

export function FinancePanel({
  caseId,
  totalCost,
}: {
  caseId: string;
  /** Стоимость услуг из договора (0, если договора ещё нет). */
  totalCost: number;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<PaymentFormState>(emptyForm());
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PaymentFormState>(emptyForm());
  const [editError, setEditError] = useState<string | null>(null);

  const reload = async () => {
    const list = await paymentService.getByCaseId(caseId);
    setPayments(list);
    setLoaded(true);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const list = await paymentService.getByCaseId(caseId);
      if (cancelled) return;
      setPayments(list);
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const summary = calculateFinanceSummary(totalCost, payments);

  function validate(form: PaymentFormState): string | null {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return "Сумма должна быть больше нуля.";
    if (!form.paymentDate) return "Укажите дату оплаты.";
    if (!form.paymentMethod) return "Укажите способ оплаты.";
    return null;
  }

  async function handleAddSubmit() {
    const error = validate(addForm);
    if (error) {
      setAddError(error);
      return;
    }
    const payment = await paymentService.create({
      caseId,
      amount: Number(addForm.amount),
      paymentDate: addForm.paymentDate,
      paymentMethod: addForm.paymentMethod,
      comment: addForm.comment.trim() || undefined,
    });
    await timelineService.addEvent(
      caseId,
      "payment_added",
      `Добавлена оплата ${formatTenge(payment.amount)}`
    );
    setShowAddForm(false);
    setAddForm(emptyForm());
    setAddError(null);
    await reload();
  }

  function startEdit(payment: Payment) {
    setEditingId(payment.id);
    setEditForm({
      amount: String(payment.amount),
      paymentDate: payment.paymentDate.slice(0, 10),
      paymentMethod: payment.paymentMethod,
      comment: payment.comment ?? "",
    });
    setEditError(null);
  }

  async function handleEditSubmit(paymentId: string) {
    const error = validate(editForm);
    if (error) {
      setEditError(error);
      return;
    }
    await paymentService.update(paymentId, {
      amount: Number(editForm.amount),
      paymentDate: editForm.paymentDate,
      paymentMethod: editForm.paymentMethod,
      comment: editForm.comment.trim() || undefined,
    });
    await timelineService.addEvent(
      caseId,
      "payment_updated",
      `Изменена оплата ${formatTenge(Number(editForm.amount))}`
    );
    setEditingId(null);
    await reload();
  }

  async function handleDelete(payment: Payment) {
    await paymentService.delete(payment.id);
    await timelineService.addEvent(
      caseId,
      "payment_deleted",
      `Удалена оплата ${formatTenge(payment.amount)}`
    );
    if (editingId === payment.id) setEditingId(null);
    await reload();
  }

  return (
    <Card>
      <CardHeader eyebrow="Ипотечное дело" title="Финансы" />
      <div className="flex flex-col gap-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3">
            <p className="text-xs text-ink-faint">Стоимость услуг</p>
            <p className="mt-1 font-data text-xl text-ink">{formatTenge(summary.totalCost)}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3">
            <p className="text-xs text-ink-faint">Оплачено</p>
            <p className="mt-1 font-data text-xl text-ink">{formatTenge(summary.totalPaid)}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3">
            <p className="text-xs text-ink-faint">Остаток</p>
            <p className="mt-1 font-data text-xl text-ink">{formatTenge(summary.remaining)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {summary.isFullyPaid && (
            <Badge tone="success">
              <CheckCircle2 size={13} />
              Оплачено полностью
            </Badge>
          )}
          {summary.overpayment > 0 && (
            <Badge tone="brass">Переплата: {formatTenge(summary.overpayment)}</Badge>
          )}
          {summary.totalCost === 0 && (
            <p className="text-xs text-ink-faint">
              Стоимость услуг появится после прикрепления договора.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            История оплат
          </p>

          {loaded && payments.length === 0 && (
            <p className="text-sm text-ink-soft">Платежей ещё не было.</p>
          )}

          <div className="flex flex-col divide-y divide-line">
            {payments.map((payment) =>
              editingId === payment.id ? (
                <div key={payment.id} className="flex flex-col gap-3 py-3.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldWrapper label="Сумма, ₸" htmlFor={`edit-amount-${payment.id}`} required>
                      <TextInput
                        id={`edit-amount-${payment.id}`}
                        type="number"
                        min={1}
                        value={editForm.amount}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, amount: e.target.value }))
                        }
                      />
                    </FieldWrapper>
                    <FieldWrapper label="Дата" htmlFor={`edit-date-${payment.id}`} required>
                      <TextInput
                        id={`edit-date-${payment.id}`}
                        type="date"
                        value={editForm.paymentDate}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, paymentDate: e.target.value }))
                        }
                      />
                    </FieldWrapper>
                    <FieldWrapper label="Способ оплаты" htmlFor={`edit-method-${payment.id}`} required>
                      <SelectInput
                        id={`edit-method-${payment.id}`}
                        value={editForm.paymentMethod}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            paymentMethod: e.target.value as PaymentMethod,
                          }))
                        }
                      >
                        {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </SelectInput>
                    </FieldWrapper>
                    <FieldWrapper label="Комментарий" htmlFor={`edit-comment-${payment.id}`}>
                      <TextArea
                        id={`edit-comment-${payment.id}`}
                        rows={1}
                        value={editForm.comment}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, comment: e.target.value }))
                        }
                      />
                    </FieldWrapper>
                  </div>
                  {editError && <p className="text-xs text-risk">{editError}</p>}
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={() => handleEditSubmit(payment.id)}>
                      Сохранить
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-ink-soft">
                      <Wallet size={16} strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {formatTenge(payment.amount)}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {formatDate(payment.paymentDate)} ·{" "}
                        {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                        {payment.comment ? ` · ${payment.comment}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => startEdit(payment)}
                    >
                      <Pencil size={13} />
                      Редактировать
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs text-risk hover:bg-risk-soft"
                      onClick={() => handleDelete(payment)}
                    >
                      <Trash2 size={13} />
                      Удалить
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

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
            <span className="text-xs font-medium text-navy">Добавить оплату</span>
          </button>
        )}

        {showAddForm && (
          <div className="flex flex-col gap-3 rounded-lg border border-line-strong p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldWrapper label="Сумма, ₸" htmlFor="add-amount" required>
                <TextInput
                  id="add-amount"
                  type="number"
                  min={1}
                  value={addForm.amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="100000"
                />
              </FieldWrapper>
              <FieldWrapper label="Дата" htmlFor="add-date" required>
                <TextInput
                  id="add-date"
                  type="date"
                  value={addForm.paymentDate}
                  onChange={(e) => setAddForm((f) => ({ ...f, paymentDate: e.target.value }))}
                />
              </FieldWrapper>
              <FieldWrapper label="Способ оплаты" htmlFor="add-method" required>
                <SelectInput
                  id="add-method"
                  value={addForm.paymentMethod}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))
                  }
                >
                  {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </SelectInput>
              </FieldWrapper>
              <FieldWrapper label="Комментарий" htmlFor="add-comment">
                <TextArea
                  id="add-comment"
                  rows={1}
                  value={addForm.comment}
                  onChange={(e) => setAddForm((f) => ({ ...f, comment: e.target.value }))}
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
