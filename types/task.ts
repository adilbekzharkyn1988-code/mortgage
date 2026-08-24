// Типы для задач в плане действий по ипотечному делу.

export type TaskPriority = "low" | "medium" | "high";

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

export type TaskStatus = "new" | "in_progress" | "done" | "cancelled";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Выполнена",
  cancelled: "Отменена",
};

export interface Task {
  id: string;
  caseId: string;
  clientId: string;

  title: string;
  description: string;
  priority: TaskPriority;
  dueDate?: string; // ISO-строка даты
  status: TaskStatus;
  comment?: string;

  // Если задача создана из рекомендации AI — сохраняем происхождение
  origin: "manual" | "ai_recommendation";

  createdAt: string;
  updatedAt: string;
}

export type NewTaskInput = Omit<
  Task,
  "id" | "createdAt" | "updatedAt" | "status"
> & {
  status?: TaskStatus;
};
