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

  // ЭТАП 4: ссылка на рекомендацию AI-анализа, из которой создана задача
  // (используется для защиты от повторного добавления одной и той же
  // рекомендации в план несколько раз).
  recommendationId?: string;
  completedAt?: string; // ISO datetime — когда задача была выполнена
  cancelledAt?: string; // ISO datetime — когда задача была отменена

  createdAt: string;
  updatedAt: string;
}

export type NewTaskInput = Omit<
  Task,
  "id" | "createdAt" | "updatedAt" | "status"
> & {
  status?: TaskStatus;
};

// ==============================================================================
// ЭТАП 4: Управление задачами — фильтрация, сортировка, прогресс, next action
// ==============================================================================

export interface TaskFilter {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  overdue?: boolean;
}

export interface TaskSort {
  by: "dueDate" | "priority" | "createdAt" | "status";
  order: "asc" | "desc";
}

export interface TaskListItem extends Task {
  daysUntilDue?: number;
  isOverdue?: boolean;
}

export interface NextActionResult {
  task: Task | null;
  reason: string; // Почему именно эта задача выбрана следующим действием
}

// Метрики прогресса дела по задачам (ЭТАП 4).
export interface CaseProgress {
  overall: number; // 0–100, доля выполненных задач
  tasksTotal: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksNew: number;
  tasksOverdue: number;
}
