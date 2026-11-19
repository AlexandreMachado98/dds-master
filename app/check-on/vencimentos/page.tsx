'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { checkon, CYCLE_LABEL, deadlineText, formatDate, type Company } from '@/lib/checkonClient';
import { ErrorBox, Loading, PageTitle, Panel, StateBadge } from '@/components/checkon/ui';

/** Vencimentos: quem está vencido, em carência ou vence nos próximos 30 dias. */
export default function ExpirationsPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkon<Company[]>('companies').then(setCompanies).catch((e) => setError(e.message));
  }, []);

  const groups = useMemo(() => {
    const list = companies ?? [];
    const byDays = (a: Company, b: Company) => (a.subscription.daysLeft ?? 0) - (b.subscription.daysLeft ?? 0);
    return [
      {
        title: 'Vencidas (acesso bloqueado)',
        empty: 'Nenhum cliente vencido.',
        items: list.filter((c) => c.subscription.state === 'VENCIDA').sort(byDays),
      },
      {
        title: 'Em carência (funcionando, com aviso no portal)',
        empty: 'Nenhum cliente em carência.',
        items: list.filter((c) => c.subscription.state === 'CARENCIA').sort(byDays),
      },
      {
        title: 'Vencem nos próximos 30 dias',
        empty: 'Nenhum cliente vence nos próximos 30 dias.',
        items: list
          .filter((c) => ['ATIVA', 'TESTE'].includes(c.subscription.state) && c.subscription.daysLeft !== null && c.subscription.daysLeft <= 30)
          .sort(byDays),
      },
    ];
  }, [companies]);

  return (
    <>
      <PageTitle title="Vencimentos" subtitle="Quem precisa de renovação. Clique no cliente para renovar." />
      <ErrorBox message={error} />
      {!companies && !error && <Loading />}
      {companies && (
        <div className="space-y-6">
          {groups.map((group) => (
            <Panel key={group.title} title={`${group.title} · ${group.items.length}`}>
              {group.items.length === 0 ? (
                <p className="text-sm text-slate-400">{group.empty}</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {group.items.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <Link href={`/check-on/clientes/${c.id}`} className="font-bold text-white hover:text-sky-300">{c.name}</Link>
                        <p className="text-xs text-slate-400">
                          {c.code} · {CYCLE_LABEL[c.billingCycle] ?? c.billingCycle} · vencimento {formatDate(c.subscription.endsAt)} · {deadlineText(c.subscription)}
                        </p>
                      </div>
                      <StateBadge state={c.subscription.state} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
