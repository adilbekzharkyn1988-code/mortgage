export function formatTenge(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(value))} ₸`;
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

// ЭТАП 4: короткая дата (день + месяц, без года) для компактных карточек задач.
export function formatDateShort(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function calculateAge(birthDateIso: string | undefined | null): number | null {
  if (!birthDateIso) return null;
  const birth = new Date(birthDateIso);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function formatFileSize(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

// Рекомендации AI-анализа хранятся одной строкой вида "Заголовок: описание"
// (см. normalizeRecommendations в lib/ai/caseAnalysis.ts). Общий разбор для
// CaseAnalysisPanel (кнопка "Добавить в план") и DossierPanel (автосоздание
// задач), чтобы заголовок/описание задачи формировались одинаково в обоих местах.
export function splitRecommendation(rec: string): { title: string; description: string } {
  const separatorIndex = rec.indexOf(": ");
  if (separatorIndex === -1) return { title: rec, description: rec };
  return {
    title: rec.slice(0, separatorIndex),
    description: rec.slice(separatorIndex + 2),
  };
}
