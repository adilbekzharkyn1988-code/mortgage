// ЭТАП 4: история событий по делу (audit trail).
// Использует тот же StorageAdapter, что и остальные сервисы (caseService,
// taskService, documentService) — единая архитектура на localStorage.

import { TimelineEvent, TimelineEventType } from "@/types/timeline";
import { createLocalStorageAdapter } from "./storageAdapter";

const STORAGE_KEY = "mortgage-crm:timeline";

const adapter = createLocalStorageAdapter<TimelineEvent>(STORAGE_KEY, []);

function generateId(): string {
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const timelineService = {
  async getByCaseId(caseId: string): Promise<TimelineEvent[]> {
    const all = await adapter.getAll();
    return all
      .filter((event) => event.caseId === caseId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async addEvent(
    caseId: string,
    type: TimelineEventType,
    title: string,
    metadata?: Record<string, unknown>
  ): Promise<TimelineEvent> {
    const event: TimelineEvent = {
      id: generateId(),
      caseId,
      type,
      title,
      metadata,
      createdAt: new Date().toISOString(),
    };
    await adapter.create(event);
    return event;
  },
};
