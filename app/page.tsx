'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ClipboardCheck, Loader2, LogOut, RefreshCw, ShieldCheck, Truck, Video, WifiOff } from 'lucide-react';

type HubData = {
  ddsOn: { ok: boolean; companies?: number; activeCompanies?: number; pendingApprovals?: number; liveMeetings?: number; error?: string };
  checkOn: {
    configured: boolean;
    online: boolean;
    problems?: string[];
    error?: string;
    summary?: { totalCompanies: number; byState: Record<string, number>; expiringIn7Days: number; inspections30d: number; vehicles: number };
  };
};

/**
 * Tela inicial do DDS Master: escolha do produto.
 * Cada produto tem a sua área, com menu e dados próprios (nada misturado).
 */
export default function ProductHub() {
  const router = useRouter();
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hub', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error(`Erro do servidor (${res.status})`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogout = async () => {
    try {
      await fetch('/api/master/auth', { method: 'DELETE' });
    } catch {}
    try {
      localStorage.removeItem('dds_master_session');
    } catch {}
    router.push('/login');
  };

  const dds = data?.ddsOn;
  const chk = data?.checkOn;
  const byState = chk?.summary?.byState ?? {};

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-900 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 shadow-lg">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div>
              <span className="block text-xs font-black uppercase tracking-widest text-slate-400">Painel do proprietário</span>
              <span className="text-base font-black tracking-tight text-white">DDS MASTER</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl border border-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-white disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Escolha o produto</h1>
        <p className="mt-1 text-sm text-slate-400">Cada produto tem a sua área, com os próprios clientes, acessos e informações.</p>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* DDS-ON */}
          <Link
            href="/dds-on"
            data-testid="product-dds-on"
            className="group flex flex-col rounded-3xl border border-green-500/20 bg-gradient-to-br from-green-950/60 to-slate-950 p-6 transition-all hover:border-green-500/50 hover:shadow-2xl hover:shadow-green-500/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 shadow-lg shadow-green-500/20">
                <Video size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">DDS-ON</h2>
                <p className="text-xs text-green-300/80">Diálogos de segurança, presenças e questionários</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label="Empresas" value={dds?.companies} loading={loading} />
              <Stat label="Ativas" value={dds?.activeCompanies} loading={loading} />
              <Stat label="Aguardando aprovação" value={dds?.pendingApprovals} loading={loading} highlight={!!dds?.pendingApprovals} tone="amber" />
            </div>
            {dds && !dds.ok && <p className="mt-3 text-xs text-red-300">{dds.error}</p>}
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-green-400 group-hover:gap-3 transition-all">
              Entrar no DDS-ON <ArrowRight size={16} />
            </span>
          </Link>

          {/* CHECK-ON */}
          <Link
            href="/check-on"
            data-testid="product-check-on"
            className="group flex flex-col rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-950/60 to-slate-950 p-6 transition-all hover:border-sky-500/50 hover:shadow-2xl hover:shadow-sky-500/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 shadow-lg shadow-sky-500/20">
                <ClipboardCheck size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">CHECK-ON</h2>
                <p className="text-xs text-sky-300/80">Inspeção de veículos: clientes, assinaturas e códigos do app</p>
              </div>
            </div>
            {chk && !chk.configured ? (
              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                <p className="font-bold">Integração ainda não configurada</p>
                <p className="mt-1 text-amber-200/80">Defina na Vercel: {chk.problems?.join('; ')}.</p>
              </div>
            ) : chk && !chk.online ? (
              <div className="mt-6 flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
                <WifiOff size={16} className="shrink-0" />
                <p>{chk.error}</p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-3 gap-3">
                <Stat label="Clientes" value={chk?.summary?.totalCompanies} loading={loading} />
                <Stat label="Vencem em 7 dias" value={chk?.summary?.expiringIn7Days} loading={loading} highlight={!!chk?.summary?.expiringIn7Days} tone="amber" />
                <Stat
                  label="Vencidos ou suspensos"
                  value={chk?.summary ? (byState.VENCIDA ?? 0) + (byState.SUSPENSA ?? 0) : undefined}
                  loading={loading}
                  highlight={!!((byState.VENCIDA ?? 0) + (byState.SUSPENSA ?? 0))}
                  tone="red"
                />
              </div>
            )}
            {chk?.online && chk.summary && (
              <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <Truck size={14} /> {chk.summary.vehicles} veículos · {chk.summary.inspections30d} inspeções nos últimos 30 dias
              </p>
            )}
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-sky-400 group-hover:gap-3 transition-all">
              Entrar no CHECK-ON <ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, loading, highlight, tone }: { label: string; value?: number; loading: boolean; highlight?: boolean; tone?: 'amber' | 'red' }) {
  const color = highlight ? (tone === 'red' ? 'text-red-400' : 'text-amber-400') : 'text-white';
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3">
      <p className={`text-2xl font-black ${color}`}>
        {loading && value === undefined ? <Loader2 size={18} className="animate-spin text-slate-500" /> : value ?? '—'}
      </p>
      <p className="mt-1 text-[11px] leading-tight text-slate-400">{label}</p>
    </div>
  );
}
