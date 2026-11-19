'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, CalendarClock, ClipboardList, PlusCircle, RefreshCw, Truck } from 'lucide-react';
import { checkon, deadlineText, formatDate, STATE_LABEL, type Summary, type SubscriptionState } from '@/lib/checkonClient';
import { Button, ErrorBox, Loading, PageTitle, Panel, StateBadge } from '@/components/checkon/ui';

const STATES: SubscriptionState[] = ['ATIVA', 'TESTE', 'CARENCIA', 'VENCIDA', 'SUSPENSA'];
const STATE_CARD: Record<SubscriptionState, string> = {
  ATIVA: 'text-green-400',
  TESTE: 'text-sky-400',
  CARENCIA: 'text-amber-400',
  VENCIDA: 'text-red-400',
  SUSPENSA: 'text-slate-300',
};

/** Painel do CHECK-ON: situação dos clientes e quem precisa de atenção. */
export default function CheckOnDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await checkon<Summary>('summary'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageTitle
        title="Painel do CHECK-ON"
        subtitle="Situação das assinaturas dos clientes."
        actions={
          <>
            <Button variant="outline" onClick={load} loading={loading}>
              {!loading && <RefreshCw size={16} />} Atualizar
            </Button>
            <Link href="/check-on/clientes/novo">
              <Button>
                <PlusCircle size={16} /> Novo cliente
              </Button>
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      {loading && !summary && <Loading />}

      {summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {STATES.map((state) => (
              <Link
                key={state}
                href={`/check-on/clientes?situacao=${state}`}
                data-testid={`state-${state}`}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 transition-colors hover:border-slate-700"
              >
                <p className={`text-3xl font-black ${STATE_CARD[state]}`}>{summary.byState[state] ?? 0}</p>
                <p className="mt-1 text-xs text-slate-400">{STATE_LABEL[state]}</p>
              </Link>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric icon={<Building2 size={18} />} label="Clientes" value={summary.totalCompanies} />
            <Metric icon={<Truck size={18} />} label="Veículos cadastrados" value={summary.vehicles} />
            <Metric icon={<ClipboardList size={18} />} label="Inspeções nos últimos 30 dias" value={summary.inspections30d} />
          </div>
          {summary.archived > 0 && (
            <p className="text-xs text-slate-500">
              {summary.archived} cliente(s) arquivado(s), fora destes números. <Link href="/check-on/arquivadas" className="font-semibold text-sky-400 hover:text-sky-300">Ver arquivados</Link>
            </p>
          )}

          <Panel title={`Vencem nos próximos 7 dias (${summary.expiringIn7Days})`}>
            {summary.expiringSoon.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum cliente vence nos próximos 7 dias.</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {summary.expiringSoon.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/check-on/clientes/${c.id}`} className="font-bold text-white hover:text-sky-300">{c.name}</Link>
                      <p className="text-xs text-slate-400">
                        {c.code} · {formatDate(c.subscription.endsAt)} · {deadlineText(c.subscription)}
                      </p>
                    </div>
                    <StateBadge state={c.subscription.state} />
                  </li>
                ))}
              </ul>
            )}
            <Link href="/check-on/vencimentos" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-sky-400 hover:gap-3 transition-all">
              <CalendarClock size={16} /> Ver todos os vencimentos <ArrowRight size={16} />
            </Link>
          </Panel>
        </div>
      )}
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">{icon}</div>
      <div>
        <p className="text-xl font-black text-white">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}
