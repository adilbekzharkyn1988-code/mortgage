import {
  ClientDocument,
  DocumentAnalysisResult,
  DocumentType,
  ExtractedFields,
} from "@/types/document";
import { createLocalStorageAdapter } from "./storageAdapter";
import { caseService } from "./caseService";

const STORAGE_KEY = "mortgage-crm:documents";

// На старте документов нет — консультант загружает их сам в процессе работы.
const adapter = createLocalStorageAdapter<ClientDocument>(STORAGE_KEY, []);

function generateId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const documentService = {
  getAll(): Promise<ClientDocument[]> {
    return adapter.getAll();
  },

  getById(id: string): Promise<ClientDocument | null> {
    return adapter.getById(id);
  },

  async getByCaseId(caseId: string): Promise<ClientDocument[]> {
    const all = await adapter.getAll();
    return all
      .filter((doc) => doc.caseId === caseId)
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  },

  async upload(params: {
    clientId: string;
    caseId: string;
    type: DocumentType;
    fileName: string;
  }): Promise<ClientDocument> {
    const now = new Date().toISOString();
    const document: ClientDocument = {
      id: generateId(),
      clientId: params.clientId,
      caseId: params.caseId,
      type: params.type,
      fileName: params.fileName,
      uploadedAt: now,
      status: "uploaded",
    };
    await adapter.create(document);
    await caseService.addDocumentId(params.caseId, document.id);
    return document;
  },

  async setAnalyzing(id: string): Promise<ClientDocument | null> {
    return adapter.update(id, { status: "analyzing" });
  },

  async setAnalysisResult(
    id: string,
    result: DocumentAnalysisResult
  ): Promise<ClientDocument | null> {
    return adapter.update(id, { status: "analyzed", analysisResult: result });
  },

  async confirm(id: string, confirmedFields: ExtractedFields): Promise<ClientDocument | null> {
    return adapter.update(id, {
      status: "confirmed",
      confirmedFields,
      confirmedAt: new Date().toISOString(),
    });
  },

  async reject(id: string): Promise<ClientDocument | null> {
    return adapter.update(id, { status: "rejected" });
  },

  async remove(id: string): Promise<boolean> {
    return adapter.remove(id);
  },
};
