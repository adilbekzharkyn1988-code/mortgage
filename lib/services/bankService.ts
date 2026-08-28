import { Bank, MortgageProgram, NewBankInput, NewMortgageProgramInput } from "@/types/bank";
import { mockBanks, mockPrograms } from "@/data/mockBanks";
import { createLocalStorageAdapter } from "./storageAdapter";

const BANKS_STORAGE_KEY = "mortgage-crm:banks";
const PROGRAMS_STORAGE_KEY = "mortgage-crm:programs";

const banksAdapter = createLocalStorageAdapter<Bank>(BANKS_STORAGE_KEY, mockBanks);
const programsAdapter = createLocalStorageAdapter<MortgageProgram>(
  PROGRAMS_STORAGE_KEY,
  mockPrograms
);

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const bankService = {
  getAll(): Promise<Bank[]> {
    return banksAdapter.getAll();
  },

  getById(id: string): Promise<Bank | null> {
    return banksAdapter.getById(id);
  },

  async create(input: NewBankInput): Promise<Bank> {
    const now = new Date().toISOString();
    const bank: Bank = { ...input, id: generateId("bank"), createdAt: now, updatedAt: now };
    await banksAdapter.create(bank);
    return bank;
  },

  async update(id: string, patch: Partial<Bank>): Promise<Bank | null> {
    return banksAdapter.update(id, { ...patch, updatedAt: new Date().toISOString() });
  },

  /** Удаляет банк вместе со всеми его программами. */
  async remove(id: string): Promise<boolean> {
    const programs = await programsAdapter.getAll();
    for (const program of programs.filter((p) => p.bankId === id)) {
      await programsAdapter.remove(program.id);
    }
    return banksAdapter.remove(id);
  },
};

export const programService = {
  getAll(): Promise<MortgageProgram[]> {
    return programsAdapter.getAll();
  },

  getById(id: string): Promise<MortgageProgram | null> {
    return programsAdapter.getById(id);
  },

  async getByBankId(bankId: string): Promise<MortgageProgram[]> {
    const all = await programsAdapter.getAll();
    return all.filter((p) => p.bankId === bankId);
  },

  async create(input: NewMortgageProgramInput): Promise<MortgageProgram> {
    const now = new Date().toISOString();
    const program: MortgageProgram = {
      ...input,
      id: generateId("program"),
      createdAt: now,
      updatedAt: now,
    };
    await programsAdapter.create(program);
    return program;
  },

  async update(id: string, patch: Partial<MortgageProgram>): Promise<MortgageProgram | null> {
    return programsAdapter.update(id, { ...patch, updatedAt: new Date().toISOString() });
  },

  async remove(id: string): Promise<boolean> {
    return programsAdapter.remove(id);
  },
};
