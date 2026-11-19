'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, ClipboardCheck, Loader2, PlugZap } from 'lucide-react';

type CheckOnStatus = { configured: boolean; online: boolean; problems?: string[]; error?: string; summary?: { totalCompanies: number } };

/** Área do CHECK-ON no DDS Master (clientes, assinaturas e códigos do app). */
export default function CheckOnArea() {
  const router = useRouter();
  const [status, setStatus] = useState<CheckOnStatus | null>(null);

  useEffect(() => {
    fetch('/api/hub', { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 401) return router.push('/login');
        const data = await res.json();
        setStatus(data.checkOn);
      })
      .catch(() => setStatus({ configured: true, online: false, error: 'Não foi possível consultar o servidor.' }));
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 shadow-lg shadow-sky-500/20">
              <ClipboardCheck size={22} className="text-white" />
            </div>
            <div>
              <span className="block text-xs font-black uppercase tracking-widest text-sky-400">CHECK-ON</span>
              <span className="text-base font-black tracking-tight text-white">DDS MASTER</span>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-white">
            <ArrowLeftRight size={14} /> Trocar de produto
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-black text-white">Área do CHECK-ON</h1>
        <p className="mt-2 text-sm text-slate-400">
          Aqui ficarão os clientes do CHECK-ON: assinaturas e vencimentos, códigos de acesso do aplicativo, suspensão e histórico.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-white"><PlugZap size={16} /> Conexão com o CHECK-ON</p>
          {!status ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Verificando...</p>
          ) : !status.configured ? (
            <p className="mt-2 text-sm text-amber-300">Não configurada. Defina na Vercel: {status.problems?.join('; ')}.</p>
          ) : status.online ? (
            <p data-testid="checkon-online" className="mt-2 text-sm text-green-400">Conectado: {status.summary?.totalCompanies ?? 0} cliente(s) no CHECK-ON.</p>
          ) : (
            <p className="mt-2 text-sm text-red-300">{status.error}</p>
          )}
        </div>
      </section>
    </main>
  );
}
