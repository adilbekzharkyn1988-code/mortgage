import {
  CaseProgress,
  NewTaskInput,
  NextActionResult,
  Task,
  TaskFilter,
  TaskListItem,
  TaskPriority,
  TaskSort,
  TaskStatus,
} from "@/types/task";
import { mockTasks } from "@/data/mockTasks";
import { createLocalStorageAdapter } from "./storageAdapter";
import { caseService } from "./caseService";
import { timelineService } from "./timelineService";

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

    await timelineService.addEvent(task.caseId, "task_created", `Создана задача: ${task.title}`, {
      taskId: task.id,
      priority: task.priority,
    });

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

    if (updated) {
      const eventTitle =
        status === "in_progress"
          ? `Задача начата: ${updated.title}`
          : status === "done"
          ? `Задача выполнена: ${updated.title}`
          : status === "cancelled"
          ? `Задача отменена: ${updated.title}`
          : null;
      const eventType =
        status === "in_progress"
          ? "task_started"
          : status === "done"
          ? "task_completed"
          : status === "cancelled"
          ? "task_cancelled"
          : null;
      if (eventTitle && eventType) {
        await timelineService.addEvent(updated.caseId, eventType, eventTitle, { taskId: id });
      }
    }

    return updated;
  },

  async remove(id: string): Promise<boolean> {
    return adapter.remove(id);
  },

  // ============================================================================
  // ЭТАП 4: план действий — создание задач из AI-рекомендаций, фильтрация,
  // сортировка, прогресс дела, определение следующего действия.
  // ============================================================================

  /** Проверяет, есть ли уже задача с таким названием в деле (защита от дублей). */
  async taskExists(caseId: string, title: string): Promise<boolean> {
    const tasks = await this.getByCaseId(caseId);
    return tasks.some((t) => t.title.toLowerCase() === title.toLowerCase());
  },

  /**
   * Создаёт задачу из рекомендации AI-анализа (кнопка "Добавить в план").
   * Возвращает null, если такая задача уже существует (дубликат).
   */
  async createTaskFromRecommendation(
    caseId: string,
    recommendation: { title: string; description: string; priority: TaskPriority },
    recommendationId: string
  ): Promise<Task | null> {
    if (await this.taskExists(caseId, recommendation.title)) {
      return null;
    }

    const parentCase = await caseService.getById(caseId);
    if (!parentCase) return null;

    const daysToAdd =
      recommendation.priority === "high" ? 1 : recommendation.priority === "medium" ? 3 : 7;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysToAdd);

    return this.create({
      caseId,
      clientId: parentCase.clientId,
      title: recommendation.title,
      description: recommendation.description,
      priority: recommendation.priority,
      dueDate: dueDate.toISOString().slice(0, 10),
      origin: "ai_recommendation",
      recommendationId,
    });
  },

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === "done" || task.status === "cancelled") return false;
    return new Date(task.dueDate) < new Date();
  },

  daysUntilDue(dueDate: string): number {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  },

  /** Возвращает отфильтрованный и отсортированный список задач дела. */
  async getFilteredTasks(caseId: string, filter?: TaskFilter, sort?: TaskSort): Promise<TaskListItem[]> {
    let tasks = await this.getByCaseId(caseId);

    if (filter) {
      if (filter.status && filter.status.length > 0) {
        tasks = tasks.filter((t) => filter.status!.includes(t.status));
      }
      if (filter.priority && filter.priority.length > 0) {
        tasks = tasks.filter((t) => filter.priority!.includes(t.priority));
      }
      if (filter.overdue) {
        tasks = tasks.filter((t) => this.isOverdue(t));
      }
    }

    const items: TaskListItem[] = tasks.map((t) => ({
      ...t,
      daysUntilDue: t.dueDate ? this.daysUntilDue(t.dueDate) : undefined,
      isOverdue: this.isOverdue(t),
    }));

    if (sort) {
      const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
      const statusOrder: Record<TaskStatus, number> = { new: 0, in_progress: 1, done: 2, cancelled: 3 };

      items.sort((a, b) => {
        let comparison = 0;
        switch (sort.by) {
          case "dueDate":
            if (a.dueDate && b.dueDate) {
              comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            } else if (a.dueDate) {
              comparison = -1;
            } else if (b.dueDate) {
              comparison = 1;
            }
            break;
          case "priority":
            comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
            break;
          case "createdAt":
            comparison = a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
            break;
          case "status":
            comparison = statusOrder[a.status] - statusOrder[b.status];
            break;
        }
        return sort.order === "asc" ? comparison : -comparison;
      });
    }

    return items;
  },

  /**
   * Определяет следующее действие "по уму": просроченная задача высокого
   * приоритета > ближайшая высокого приоритета > среднего > низкого.
   * (Отдельно от caseService.nextActionTaskId — то поле хранит "закреплённую"
   * консультантом задачу и используется в NextActionBanner на дашборде.)
   */
  async getNextAction(caseId: string): Promise<NextActionResult> {
    const active = await this.getFilteredTasks(
      caseId,
      { status: ["new", "in_progress"] },
      { by: "dueDate", order: "asc" }
    );

    if (active.length === 0) {
      return { task: null, reason: "Нет активных задач" };
    }

    const overdueHigh = active.find((t) => t.isOverdue && t.priority === "high");
    if (overdueHigh) return { task: overdueHigh, reason: "Просроченная задача высокого приоритета" };

    const nearestHigh = active.find((t) => t.priority === "high");
    if (nearestHigh) return { task: nearestHigh, reason: "Задача высокого приоритета" };

    const nearestMedium = active.find((t) => t.priority === "medium");
    if (nearestMedium) return { task: nearestMedium, reason: "Задача среднего приоритета" };

    return { task: active[0], reason: "Следующая задача" };
  },

  /** Метрики прогресса дела по задачам — для панели плана действий. */
  async getCaseProgress(caseId: string): Promise<CaseProgress> {
    const tasks = await this.getByCaseId(caseId);
    const completed = tasks.filter((t) => t.status === "done");
    const inProgress = tasks.filter((t) => t.status === "in_progress");
    const fresh = tasks.filter((t) => t.status === "new");
    const overdue = tasks.filter((t) => this.isOverdue(t));

    return {
      overall: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0,
      tasksTotal: tasks.length,
      tasksCompleted: completed.length,
      tasksInProgress: inProgress.length,
      tasksNew: fresh.length,
      tasksOverdue: overdue.length,
    };
  },
};
