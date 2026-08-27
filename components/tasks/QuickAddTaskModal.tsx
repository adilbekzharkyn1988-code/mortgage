"use client";

// ЭТАП 6, п.6.19: быстрое действие "+ Добавить задачу" на Dashboard.
// Ручного создания задачи вне карточки дела раньше не было — здесь
// используется тот же taskService.create(), что и в ActionPlanPanel,
// просто с выбором клиента/дела в начале формы.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Client } from "@/types/client";
import { clientService } from "@/lib/services/clientService";
import { caseService } from "@/lib/services/caseService";
import { taskService } from "@/lib/services/taskService";
import { TaskPriority, TASK_PRIORITY_LABELS } from "@/types/task";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, SelectInput, TextArea, TextInput } from "@/components/ui/FormField";

export function QuickAddTaskModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    clientService.getAll().then((list) => {
      setClients(list);
      if (list.length > 0) setClientId(list[0].id);
    });
  }, []);

  async function handleSubmit() {
    if (!clientId) {
      setError("Выберите клиента.");
      return;
    }
    if (!title.trim()) {
      setError("Укажите название задачи.");
      return;
    }
    const parentCase = await caseService.getByClientId(clientId);
    if (!parentCase) {
      setError("У выбранного клиента ещё нет ипотечного дела.");
      return;
    }
    setSaving(true);
    await taskService.create({
      caseId: parentCase.id,
      clientId,
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || undefined,
      origin: "manual",
    });
    setSaving(false);
    onCreated?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-lg text-ink">Новая задача</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <FieldWrapper label="Клиент" htmlFor="quick-task-client" required>
            <SelectInput
              id="quick-task-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={!clients || clients.length === 0}
            >
              {!clients && <option>Загрузка…</option>}
              {clients?.length === 0 && <option>Нет клиентов</option>}
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </SelectInput>
          </FieldWrapper>

          <FieldWrapper label="Название задачи" htmlFor="quick-task-title" required>
            <TextInput
              id="quick-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Позвонить клиенту"
            />
          </FieldWrapper>

          <FieldWrapper label="Описание" htmlFor="quick-task-description">
            <TextArea
              id="quick-task-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FieldWrapper>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldWrapper label="Приоритет" htmlFor="quick-task-priority">
              <SelectInput
                id="quick-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {(["high", "medium", "low"] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </SelectInput>
            </FieldWrapper>
            <FieldWrapper label="Срок" htmlFor="quick-task-due">
              <TextInput
                id="quick-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </FieldWrapper>
          </div>

          {error && <p className="text-xs text-risk">{error}</p>}

          <div className="flex gap-2">
            <Button variant="primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "Сохранение…" : "Создать задачу"}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
