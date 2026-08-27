"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, UserPlus, FolderKanban, ListChecks, CalendarDays } from "lucide-react";
import { ReactNode } from "react";

const NAV_ITEMS: { href: string; label: string; icon: ReactNode; match: (p: string) => boolean }[] = [
  {
    href: "/dashboard",
    label: "Дашборд",
    icon: <LayoutDashboard size={18} strokeWidth={1.75} />,
    match: (p) => p === "/" || p === "/dashboard",
  },
  {
    href: "/clients",
    label: "Клиенты",
    icon: <Users size={18} strokeWidth={1.75} />,
    match: (p) => p === "/clients" || (p.startsWith("/clients/") && !p.startsWith("/clients/new")),
  },
  {
    href: "/tasks",
    label: "Задачи",
    icon: <ListChecks size={18} strokeWidth={1.75} />,
    match: (p) => p.startsWith("/tasks"),
  },
  {
    href: "/calendar",
    label: "Календарь",
    icon: <CalendarDays size={18} strokeWidth={1.75} />,
    match: (p) => p.startsWith("/calendar"),
  },
  {
    href: "/clients/new",
    label: "Новый клиент",
    icon: <UserPlus size={18} strokeWidth={1.75} />,
    match: (p) => p.startsWith("/clients/new"),
  },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/40 bg-navy-dark text-brass">
          <FolderKanban size={18} strokeWidth={1.75} />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[17px] text-white">MortgageDesk</p>
          <p className="text-[11px] uppercase tracking-wider text-white/45">
            CRM брокера
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2">
        <p className="px-2.5 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-white/35">
          Рабочее пространство
        </p>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/65 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brass" />
                  )}
                  <span className={active ? "text-brass" : "text-white/45 group-hover:text-white/70"}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-3 mb-5 mt-auto rounded-lg border border-white/10 bg-white/5 px-3.5 py-3">
        <p className="text-xs font-medium text-white/80">MVP-0 · демо-данные</p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          Все данные хранятся локально в браузере (localStorage).
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 bg-navy-dark lg:block">
      <div className="fixed h-screen w-64">
        <SidebarContent />
      </div>
    </aside>
  );
}
