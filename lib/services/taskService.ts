import { NewTaskInput, Task, TaskStatus } from "@/types/task";
import { mockTasks } from "@/data/mockTasks";
import { createLocalStorageAdapter } from "./storageAdapter";
import { caseService } from "./caseService";

const STORAGE_KEY = "mortgage-crm:tasks";

const adapter = createLocalStorageAdapter<Task>(STORAGE_KEY, mockTasks);

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const taskService = {
  getAll(): Promise<Task[]> {
    return adapter.getAll();
  },

  getById(id: string): Promise<Task | null> {
    return adapter.getById(id);
  },

  async getByCaseId(caseId: string): Promise<Task[]> {
    const all = await adapter.getAll();
    return all
      .filter((task) => task.caseId === caseId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async create(input: NewTaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      ...input,
      id: generateId(),
      status: input.status ?? "new",
      createdAt: now,
      updatedAt: now,
    };
    await adapter.create(task);
    await caseService.addTaskId(task.caseId, task.id);

    // Если в деле ещё нет "следующего действия" — назначаем свежесозданную задачу.
    const parentCase = await caseService.getById(task.caseId);
    if (parentCase && !parentCase.nextActionTaskId) {
      await caseService.setNextAction(task.caseId, task.id);
    }

    return task;
  },

  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    return adapter.update(id, { ...patch, updatedAt: new Date().toISOString() });
  },

  async setStatus(id: string, status: TaskStatus): Promise<Task | null> {
    const updated = await this.update(id, { status });

    // Если задачу закрыли (выполнена/отменена) и она была "следующим действием" —
    // нужно найти новое следующее действие среди оставшихся активных задач.
    if (updated && (status === "done" || status === "cancelled")) {
      const parentCase = await caseService.getById(updated.caseId);
      if (parentCase?.nextActionTaskId === id) {
        const remaining = await this.getByCaseId(updated.caseId);
        const nextCandidate = remaining.find(
          (t) => t.id !== id && (t.status === "new" || t.status === "in_progress")
        );
        await caseService.setNextAction(updated.caseId, nextCandidate?.id);
      }
    }

    return updated;
  },

  async remove(id: string): Promise<boolean> {
    return adapter.remove(id);
  },
};
