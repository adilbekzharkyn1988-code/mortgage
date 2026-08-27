// ЭТАП 5: платежи по ипотечному делу.
// Использует тот же StorageAdapter, что и остальные сервисы — единая
// архитектура на localStorage (см. lib/services/storageAdapter.ts).

import { NewPaymentInput, Payment } from "@/types/finance";
import { createLocalStorageAdapter } from "./storageAdapter";

const STORAGE_KEY = "mortgage-crm:payments";

const adapter = createLocalStorageAdapter<Payment>(STORAGE_KEY, []);

function generateId(): string {
  return `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const paymentService = {
  getAll(): Promise<Payment[]> {
    return adapter.getAll();
  },

  getById(id: string): Promise<Payment | null> {
    return adapter.getById(id);
  },

  async getByCaseId(caseId: string): Promise<Payment[]> {
    const all = await adapter.getAll();
    return all
      .filter((p) => p.caseId === caseId)
      .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));
  },

  async create(input: NewPaymentInput): Promise<Payment> {
    const now = new Date().toISOString();
    const payment: Payment = {
      id: generateId(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await adapter.create(payment);
    return payment;
  },

  async update(id: string, patch: Partial<Payment>): Promise<Payment | null> {
    return adapter.update(id, { ...patch, updatedAt: new Date().toISOString() });
  },

  async delete(id: string): Promise<boolean> {
    return adapter.remove(id);
  },

  async getTotalPaid(caseId: string): Promise<number> {
    const payments = await this.getByCaseId(caseId);
    return payments.reduce((sum, p) => sum + p.amount, 0);
  },
};
