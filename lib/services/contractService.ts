// ЭТАП 5: договоры по ипотечному делу.
// Использует тот же StorageAdapter, что и остальные сервисы — единая
// архитектура на localStorage (см. lib/services/storageAdapter.ts).

import { Contract, ContractStatus, NewContractInput } from "@/types/finance";
import { createLocalStorageAdapter } from "./storageAdapter";

const STORAGE_KEY = "mortgage-crm:contracts";

// На старте договоров нет — консультант прикрепляет их сам в процессе работы.
const adapter = createLocalStorageAdapter<Contract>(STORAGE_KEY, []);

function generateId(): string {
  return `contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const contractService = {
  getAll(): Promise<Contract[]> {
    return adapter.getAll();
  },

  getById(id: string): Promise<Contract | null> {
    return adapter.getById(id);
  },

  /**
   * У дела на практике один действующий договор (см. карточку дела, п.5.8 ТЗ),
   * но метод возвращает все договоры дела — самый новый первым — на случай
   * перезаключения. Компонент карточки дела показывает первый (текущий).
   */
  async getByCaseId(caseId: string): Promise<Contract[]> {
    const all = await adapter.getAll();
    return all
      .filter((c) => c.caseId === caseId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async create(input: NewContractInput): Promise<Contract> {
    const now = new Date().toISOString();
    const contract: Contract = {
      id: generateId(),
      status: "draft",
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await adapter.create(contract);
    return contract;
  },

  async update(id: string, patch: Partial<Contract>): Promise<Contract | null> {
    return adapter.update(id, { ...patch, updatedAt: new Date().toISOString() });
  },

  async setStatus(id: string, status: ContractStatus): Promise<Contract | null> {
    return this.update(id, { status });
  },

  async delete(id: string): Promise<boolean> {
    return adapter.remove(id);
  },
};
