import { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...props
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_3px_rgba(20,21,43,0.04)] ${className}`}
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
    <div className="flex items-start justify-between gap-4 px-6 py-5">
      <div>
        {eyebrow && <p className="mb-1 text-[13px] text-ink-faint">{eyebrow}</p>}
        <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}
