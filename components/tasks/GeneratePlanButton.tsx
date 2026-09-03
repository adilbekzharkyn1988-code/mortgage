"use client";

// Пакетное создание задач из всех рекомендаций AI-анализа за один клик —
// вместо того чтобы нажимать "Добавить в план" под каждой рекомендацией
// по отдельности. Даты задач выставляются автоматически: чем выше
// приоритет — тем ближе срок (см. taskService.createTaskFromRecommendation).

import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { taskService } from "@/lib/services/taskService";
import { splitRecommendation, inferRecommendationPriority } from "@/lib/format";

type State = "idle" | "creating" | "done";

export function GeneratePlanButton({
  caseId,
  recommendations,
  onTasksCreated,
}: {
  caseId: string;
  recommendations: string[];
  onTasksCreated?: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [createdCount, setCreatedCount] = useState(0);

  const handleClick = async () => {
    setState("creating");
    let created = 0;

    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];
      const { title, description } = splitRecommendation(rec);
      const priority = inferRecommendationPriority(rec);
      const task = await taskService.createTaskFromRecommendation(
        caseId,
        { title, description, priority },
        `rec_${i}`
      );
      if (task) created += 1;
    }

    setCreatedCount(created);
    setState("done");
    if (created > 0) onTasksCreated?.();
    setTimeout(() => setState("idle"), 3000);
  };

  if (state === "creating") {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded-lg bg-navy-soft px-3 py-1.5 text-[13px] font-medium text-navy"
      >
        <div className="h-3.5 w-3.5 animate-spin rounded-full border border-navy/40 border-t-navy" />
        Формирую план…
      </button>
    );
  }

  if (state === "done") {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-[13px] font-medium text-success"
      >
        <Check size={14} />
        {createdCount > 0 ? `Добавлено задач: ${createdCount}` : "Все задачи уже в плане"}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-navy/90"
    >
      <Sparkles size={14} />
      Сформировать план действий
    </button>
  );
}
