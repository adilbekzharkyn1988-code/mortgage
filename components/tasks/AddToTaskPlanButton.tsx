"use client";

import { useState } from "react";
import { Plus, Check, AlertCircle } from "lucide-react";
import { taskService } from "@/lib/services/taskService";
import { TaskPriority } from "@/types/task";

interface AddToTaskPlanButtonProps {
  caseId: string;
  recommendation: {
    title: string;
    description: string;
    priority: TaskPriority;
  };
  recommendationId: string;
  onTaskCreated?: () => void;
}

type ButtonState = "idle" | "creating" | "success" | "exists";

export function AddToTaskPlanButton({
  caseId,
  recommendation,
  recommendationId,
  onTaskCreated,
}: AddToTaskPlanButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");

  const handleClick = async () => {
    setState("creating");
    try {
      const task = await taskService.createTaskFromRecommendation(
        caseId,
        recommendation,
        recommendationId
      );

      if (!task) {
        setState("exists");
        setTimeout(() => setState("idle"), 3000);
        return;
      }

      setState("success");
      onTaskCreated?.();
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
    }
  };

  if (state === "exists") {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-ink-faint cursor-not-allowed"
      >
        <AlertCircle size={14} />
        Уже в плане
      </button>
    );
  }

  if (state === "success") {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded bg-success-soft px-3 py-1.5 text-xs font-medium text-success"
      >
        <Check size={14} />
        Добавлено
      </button>
    );
  }

  if (state === "creating") {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-ink-faint"
      >
        <div className="h-3 w-3 animate-spin rounded-full border border-ink-faint border-t-ink" />
        Добавляю...
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded bg-navy-soft px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-navy hover:text-white"
    >
      <Plus size={14} />
      Добавить в план
    </button>
  );
}
