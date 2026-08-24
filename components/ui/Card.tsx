import { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...props
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,36,48,0.04)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  eyebrow,
  action,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-lg text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}
