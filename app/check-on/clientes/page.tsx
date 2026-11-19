'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlusCircle, Search } from 'lucide-react';
import { checkon, CYCLE_LABEL, deadlineText, formatDate, formatDateTime, STATE_LABEL, type Company, type SubscriptionState } from '@/lib/checkonClient';
import { Button, ErrorBox, inputClass, Loading, PageTitle, StateBadge } from '@/components/checkon/ui';

const FILTERS: Array<SubscriptionState | 'TODAS'> = ['TODAS', 'ATIVA', 'TESTE', 'CARENCIA', 'VENCIDA', 'SUSPENSA'];

function ClientList() {
  const params = useSearchParams();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SubscriptionState | 'TODAS'>(() => {
    const value = params.get('situacao') as SubscriptionState | null;
    return value && value in STATE_LABEL ? value : 'TODAS';
  });

  useEffect(() => {
    checkon<Company[]>('companies').then(setCompanies).catch((e) => setError(e.message));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return (companies ?? []).filter(
      (c) =>
        (filter === 'TODAS' || c.subscription.state === filter) &&
        (!q || c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q) || (digits.length >= 3 && (c.cnpj ?? '').includes(digits))),
    );
  }, [companies, filter, query]);

  return (
    <>
      <PageTitle
        title="Clientes"
        subtitle="Empresas que usam o CHECK-ON."
        actions={
          <Link href="/check-on/clientes/novo">
            <Button testId="new-client">
              <PlusCircle size={16} /> Novo cliente
            </Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className={`${inputClass} pl-10`} placeholder="Buscar por nome, código ou CNPJ" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                filter === f ? 'border-sky-500 bg-sky-500/15 text-sky-200' : 'border-slate-800 text-slate-400 hover:bg-slate-900'
              }`}
            >
              {f === 'TODAS' ? 'Todas' : STATE_LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      <ErrorBox message={error} />
      {!companies && !error && <Loading />}
      {companies && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Código do app</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3 text-right">Veículos</th>
                <th className="px-4 py-3 text-right">Inspeções (30 dias)</th>
                <th className="px-4 py-3">Última inspeção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {companies.length === 0 ? 'Nenhum cliente ainda. Cadastre o primeiro em "Novo cliente".' : 'Nenhum cliente com esse filtro.'}
                  </td>
                </tr>
              )}
              {visible.map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3">
                    <Link href={`/check-on/clientes/${c.id}`} className="font-bold text-white hover:text-sky-300">{c.name}</Link>
                    <p className="text-xs text-slate-500">{CYCLE_LABEL[c.billingCycle] ?? c.billingCycle}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-sky-200">{c.code ?? '—'}</td>
                  <td className="px-4 py-3"><StateBadge state={c.subscription.state} /></td>
                  <td className="px-4 py-3">
                    <p className="text-slate-200">{formatDate(c.subscription.endsAt)}</p>
                    <p className="text-xs text-slate-500">{deadlineText(c.subscription)}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-200">{c.usage.vehicles}</td>
                  <td className="px-4 py-3 text-right text-slate-200">{c.usage.inspections30d}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(c.usage.lastInspectionAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ClientList />
    </Suspense>
  );
}
