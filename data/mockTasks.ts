import { Task } from "@/types/task";

export const mockTasks: Task[] = [
  {
    id: "task-1-1",
    caseId: "case-1",
    clientId: "client-1",
    title: "Уточнить расхождение дохода",
    description:
      "По консультации доход указан 700 000 ₸, по справке о доходах — 650 000 ₸. Нужно уточнить у клиента причину расхождения.",
    priority: "high",
    dueDate: "2026-08-26",
    status: "new",
    origin: "ai_recommendation",
    createdAt: "2026-08-18T14:40:00.000Z",
    updatedAt: "2026-08-18T14:40:00.000Z",
  },
  {
    id: "task-1-2",
    caseId: "case-1",
    clientId: "client-1",
    title: "Получить пенсионные отчисления",
    description: "Запросить у клиента выписку по пенсионным отчислениям за последние 12 месяцев.",
    priority: "medium",
    dueDate: "2026-08-28",
    status: "in_progress",
    origin: "ai_recommendation",
    createdAt: "2026-08-18T14:40:00.000Z",
    updatedAt: "2026-08-19T09:00:00.000Z",
  },
  {
    id: "task-2-1",
    caseId: "case-2",
    clientId: "client-2",
    title: "Получить кредитную историю",
    description: "Клиент ещё не предоставил кредитную историю — необходимо запросить.",
    priority: "high",
    dueDate: "2026-08-25",
    status: "new",
    origin: "manual",
    createdAt: "2026-08-20T10:05:00.000Z",
    updatedAt: "2026-08-20T10:05:00.000Z",
  },
];
