'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ACTION_LABEL, checkon, formatDateTime, type HistoryEntry } from '@/lib/checkonClient';
import { ErrorBox, Loading, PageTitle } from '@/components/checkon/ui';

/** Resumo legível dos detalhes de uma ação. */
function describe(entry: HistoryEntry): string {
  const d = (entry.details ?? {}) as Record<string, any>;
  const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'sem vencimento');
  switch (entry.action) {
    case 'COMPANY_CREATED':
      return `Código ${d.code} · ${d.billingCycle} até ${date(d.subscriptionEndsAt)} · administrador ${d.adminEmail}`;
    case 'SUBSCRIPTION_RENEWED':
      return `De ${date(d.from)} para ${date(d.to)} (${d.billingCycle})`;
    case 'ADMIN_PASSWORD_RESET':
      return `Administrador ${d.adminEmail}`;
    default: {
      const labels: Record<string, string> = {
        name: 'nome', cnpj: 'CNPJ', code: 'código', billingCycle: 'tipo', subscriptionEndsAt: 'vencimento', graceDays: 'carência', notes: 'anotações', isActive: 'ativo',
      };
      return Object.entries(d)
        .map(([key, change]) => {
          const c = change as { from: unknown; to: unknown };
          const show = (v: unknown) => (key === 'subscriptionEndsAt' ? date(v as string | null) : v === null || v === '' ? '—' : String(v));
          return key === 'notes' ? 'anotações alteradas' : `${labels[key] ?? key}: ${show(c?.from)} → ${show(c?.to)}`;
        })
        .join(' · ');
    }
  }
}

/** Histórico: tudo o que foi feito nos clientes do CHECK-ON pelo DDS Master. */
export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkon<HistoryEntry[]>('history?limit=200').then(setHistory).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <PageTitle title="Histórico" subtitle="Quem fez o quê nos clientes do CHECK-ON (últimas 200 ações)." />
      <ErrorBox message={error} />
      {!history && !error && <Loading />}
      {history && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Detalhes</th>
                <th className="px-4 py-3">Quem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {history.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nenhuma ação registrada ainda.</td></tr>
              )}
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatDateTime(h.createdAt)}</td>
                  <td className="px-4 py-3">
                    {h.tenant ? <Link href={`/check-on/clientes/${h.tenant.id}`} className="font-semibold text-white hover:text-sky-300">{h.tenant.name}</Link> : '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-200">{ACTION_LABEL[h.action] ?? h.action}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{describe(h)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{h.actor ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
