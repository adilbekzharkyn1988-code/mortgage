import { Client, NewClientInput } from "@/types/client";
import { MortgageCase } from "@/types/mortgageCase";
import { mockClients } from "@/data/mockClients";
import { createLocalStorageAdapter } from "./storageAdapter";
import { caseService } from "./caseService";

const STORAGE_KEY = "mortgage-crm:clients";

const adapter = createLocalStorageAdapter<Client>(STORAGE_KEY, mockClients);

function generateId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const clientService = {
  getAll(): Promise<Client[]> {
    return adapter.getAll();
  },

  getById(id: string): Promise<Client | null> {
    return adapter.getById(id);
  },

  /**
   * Создаёт клиента и одновременно новое ипотечное дело для него
   * (на этапе "Консультация"), т.к. по сценарию каждая консультация
   * автоматически порождает дело.
   */
  async create(input: NewClientInput): Promise<{ client: Client; mortgageCase: MortgageCase }> {
    const now = new Date().toISOString();
    const clientId = generateId();
    const caseId = `case-${clientId}`;

    const client: Client = {
      ...input,
      id: clientId,
      caseId,
      createdAt: now,
      updatedAt: now,
    };

    await adapter.create(client);
    const mortgageCase = await caseService.createForClient(client);

    return { client, mortgageCase };
  },

  async update(id: string, patch: Partial<Client>): Promise<Client | null> {
    return adapter.update(id, { ...patch, updatedAt: new Date().toISOString() });
  },

  async remove(id: string): Promise<boolean> {
    return adapter.remove(id);
  },
};
