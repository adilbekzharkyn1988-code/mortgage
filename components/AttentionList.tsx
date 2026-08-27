// ЭТАП 6, п.6.8: единый компонент для блока "ТРЕБУЕТ ВНИМАНИЯ".
// Используется и в карточке дела (проблемы конкретного дела), и на
// Dashboard (агрегированные показатели по всем делам).

import Link from "next/link";
import { AlertTriangle, ChevronRight, CheckCircle2 } from "lucide-react";

export interface AttentionItem {
  id: string;
  label: string;
  /** Необязательное короткое пояснение под заголовком. */
  detail?: string;
  /** Если указано — пункт ведёт к соответствующему месту CRM. */
  href?: string;
}

export function AttentionList({
  items,
  emptyMessage = "Всё в порядке — открытых проблем нет.",
}: {
  items: AttentionItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-success/15 bg-success-soft px-4 py-3 text-sm text-success">
        <CheckCircle2 size={17} strokeWidth={1.75} className="shrink-0" />
        <span className="font-medium">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const content = (
          <>
            <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{item.label}</p>
              {item.detail && <p className="mt-0.5 text-xs text-ink-faint">{item.detail}</p>}
            </div>
            {item.href && (
              <ChevronRight size={16} className="mt-0.5 shrink-0 text-ink-faint" />
            )}
          </>
        );

        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className="flex items-start gap-2.5 rounded-lg border border-warn/20 bg-warn-soft px-4 py-3 transition-colors hover:bg-warn-soft/70"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-start gap-2.5 rounded-lg border border-warn/20 bg-warn-soft px-4 py-3">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
