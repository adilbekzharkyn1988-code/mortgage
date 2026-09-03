import { Client } from "@/types/client";
import {
  CASE_STAGE_ORDER,
  CaseStage,
  Discrepancy,
  DossierAnalysis,
  MortgageCase,
} from "@/types/mortgageCase";
import { mockCases } from "@/data/mockCases";
import { createLocalStorageAdapter } from "./storageAdapter";

const STORAGE_KEY = "mortgage-crm:cases";

const adapter = createLocalStorageAdapter<MortgageCase>(STORAGE_KEY, mockCases);

// Примерный процент прогресса, соответствующий каждому этапу.
// Используется как базовое значение — прогресс дальше может
// уточняться количеством подтверждённых документов и т.д.
const STAGE_BASE_PROGRESS: Record<CaseStage, number> = {
  consultation: 10,
  document_collection: 35,
  dossier_analysis: 65,
  submission_preparation: 90,
};

export const caseService = {
  getAll(): Promise<MortgageCase[]> {
    return adapter.getAll();
  },

  getById(id: string): Promise<MortgageCase | null> {
    return adapter.getById(id);
  },

  async getByClientId(clientId: string): Promise<MortgageCase | null> {
    const all = await adapter.getAll();
    return all.find((c) => c.clientId === clientId) ?? null;
  },

  async createForClient(client: Client): Promise<MortgageCase> {
    const now = new Date().toISOString();
    const mortgageCase: MortgageCase = {
      id: client.caseId,
      clientId: client.id,
      stage: "consultation",
      progressPercent: STAGE_BASE_PROGRESS.consultation,
      documentIds: [],
      taskIds: [],
      discrepancies: [],
      analyses: [],
      nextActionTaskId: undefined,
      createdAt: now,
      updatedAt: now,
    };
    await adapter.create(mortgageCase);
    return mortgageCase;
  },

  async update(id: string, patch: Partial<MortgageCase>): Promise<MortgageCase | null> {
    return adapter.update(id, { ...patch, updatedAt: new Date().toISOString() });
  },

  async setStage(id: string, stage: CaseStage): Promise<MortgageCase | null> {
    return this.update(id, { stage, progressPercent: STAGE_BASE_PROGRESS[stage] });
  },

  /** Продвинуть дело на следующий этап (если это возможно). */
  async advanceStage(id: string): Promise<MortgageCase | null> {
    const current = await adapter.getById(id);
    if (!current) return null;
    const currentIndex = CASE_STAGE_ORDER.indexOf(current.stage);
    const nextStage = CASE_STAGE_ORDER[currentIndex + 1];
    if (!nextStage) return current;
    return this.setStage(id, nextStage);
  },

  async addDocumentId(id: string, documentId: string): Promise<MortgageCase | null> {
    const current = await adapter.getById(id);
    if (!current) return null;
    if (current.documentIds.includes(documentId)) return current;
    return this.update(id, { documentIds: [...current.documentIds, documentId] });
  },

  async addTaskId(id: string, taskId: string): Promise<MortgageCase | null> {
    const current = await adapter.getById(id);
    if (!current) return null;
    if (current.taskIds.includes(taskId)) return current;
    return this.update(id, { taskIds: [...current.taskIds, taskId] });
  },

  async addDiscrepancy(id: string, discrepancy: Discrepancy): Promise<MortgageCase | null> {
    const current = await adapter.getById(id);
    if (!current) return null;
    return this.update(id, {
      discrepancies: [...current.discrepancies, discrepancy],
    });
  },

  /**
   * Убирает из дела расхождения по указанным полям — используется, когда
   * данные клиента только что синхронизированы с документом (например,
   * "Текущие кредиты" подтянуты из кредитной истории) и ранее найденное
   * расхождение по этому полю больше не актуально: оно бы иначе висело в
   * списке "Обнаруженные несоответствия" даже после автоисправления.
   */
  async resolveDiscrepanciesByField(id: string, fields: string[]): Promise<MortgageCase | null> {
    const current = await adapter.getById(id);
    if (!current) return null;
    return this.update(id, {
      discrepancies: current.discrepancies.filter((d) => !fields.includes(d.field)),
    });
  },

  async addAnalysis(id: string, analysis: DossierAnalysis): Promise<MortgageCase | null> {
    const current = await adapter.getById(id);
    if (!current) return null;
    return this.update(id, {
      analyses: [...current.analyses, analysis],
      discrepancies: [
        ...current.discrepancies,
        ...analysis.discrepancies.filter(
          (d) => !current.discrepancies.some((existing) => existing.id === d.id)
        ),
      ],
    });
  },

  async setNextAction(id: string, taskId: string | undefined): Promise<MortgageCase | null> {
    return this.update(id, { nextActionTaskId: taskId });
  },
};
