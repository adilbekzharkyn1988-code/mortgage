import { clientService } from "@/lib/services/clientService";
import { caseService } from "@/lib/services/caseService";
import { taskService } from "@/lib/services/taskService";
import { Client } from "@/types/client";
import { MortgageCase } from "@/types/mortgageCase";
import { Task } from "@/types/task";

export interface ClientOverview {
  client: Client;
  mortgageCase: MortgageCase | null;
  nextActionTask: Task | null;
}

/**
 * Собирает клиентов вместе с их делами и задачей "следующее действие".
 * Используется на Dashboard и в списке клиентов, чтобы не дублировать
 * логику соединения нескольких сервисов в каждом компоненте.
 */
export async function getClientOverviews(): Promise<ClientOverview[]> {
  const [clients, cases, tasks] = await Promise.all([
    clientService.getAll(),
    caseService.getAll(),
    taskService.getAll(),
  ]);

  const caseByClientId = new Map(cases.map((c) => [c.clientId, c]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  return clients
    .map((client) => {
      const mortgageCase = caseByClientId.get(client.id) ?? null;
      const nextActionTask = mortgageCase?.nextActionTaskId
        ? (taskById.get(mortgageCase.nextActionTaskId) ?? null)
        : null;
      return { client, mortgageCase, nextActionTask };
    })
    .sort((a, b) => (a.client.updatedAt < b.client.updatedAt ? 1 : -1));
}
