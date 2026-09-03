"use client";

export interface TabDef {
  id: string;
  label: string;
  /** Необязательный числовой бейдж (например, количество проблем). */
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-3 text-[14px] font-medium transition-colors ${
              isActive ? "text-navy" : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
            {typeof tab.count === "number" && tab.count > 0 && (
              <span
                className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold ${
                  isActive ? "bg-navy text-white" : "bg-surface-sunken text-ink-soft"
                }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-navy" />
            )}
          </button>
        );
      })}
    </div>
  );
}
