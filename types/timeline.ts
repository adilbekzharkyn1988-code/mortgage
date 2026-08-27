// ЭТАП 4: события истории дела (audit trail) — кто что сделал и когда.
// Полностью новая сущность, не пересекается с типами предыдущих этапов.

export type TimelineEventType =
  | "case_created"
  | "stage_changed"
  | "document_uploaded"
  | "document_analyzed"
  | "case_analyzed"
  | "task_created"
  | "task_started"
  | "task_completed"
  | "task_cancelled"
  // ЭТАП 5: договоры и платежи
  | "contract_created"
  | "contract_updated"
  | "contract_deleted"
  | "contract_status_changed"
  | "payment_added"
  | "payment_updated"
  | "payment_deleted"
  // ЭТАП 6.1 (доп.): автозаполнение текущих кредитов клиента из кредитной истории
  | "client_credits_synced";

export interface TimelineEvent {
  id: string;
  caseId: string;
  type: TimelineEventType;
  title: string;
  metadata?: Record<string, unknown>;
  createdAt: string; // ISO datetime
}
