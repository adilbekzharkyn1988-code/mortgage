"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { getClientOverviews, ClientOverview } from "@/lib/aggregations";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/FormField";
import { ClientListRow } from "@/components/ClientListRow";

export default function ClientsPage() {
  const [overviews, setOverviews] = useState<ClientOverview[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getClientOverviews().then(setOverviews);
  }, []);

  const filtered = useMemo(() => {
    if (!overviews) return [];
    const q = query.trim().toLowerCase();
    if (!q) return overviews;
    return overviews.filter(
      ({ client }) =>
        client.fullName.toLowerCase().includes(q) ||
        client.city.toLowerCase().includes(q) ||
        client.phone.includes(q)
    );
  }, [overviews, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            База клиентов
          </p>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">Клиенты</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {overviews ? `Всего: ${overviews.length}` : "Загрузка…"}
          </p>
        </div>
        <LinkButton href="/clients/new">
          <UserPlus size={16} />
          Новый клиент
        </LinkButton>
      </div>

      <div className="relative max-w-sm">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени, городу, телефону"
          className="pl-9"
        />
      </div>

      <Card>
        <div className="divide-y divide-line">
          {overviews === null && (
            <p className="px-5 py-8 text-center text-sm text-ink-soft">Загрузка…</p>
          )}
          {overviews !== null && filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-soft">
              Ничего не найдено.
            </p>
          )}
          {filtered.map(({ client, mortgageCase }) => (
            <ClientListRow key={client.id} client={client} mortgageCase={mortgageCase} />
          ))}
        </div>
      </Card>
    </div>
  );
}
