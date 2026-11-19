'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { checkon, type Company } from '@/lib/checkonClient';
import { Button, ErrorBox, Loading, PageTitle, StateBadge } from '@/components/checkon/ui';
import { CodeDialog } from '@/components/checkon/dialogs';

/** Códigos de acesso: o código que os motoristas de cada cliente digitam no aplicativo. */
export default function CodesPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Company | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    checkon<Company[]>('companies').then(setCompanies).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <PageTitle title="Códigos de acesso" subtitle="No aplicativo, o motorista entra com o código da empresa e a sua matrícula." />
      {notice && <p role="status" className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">{notice}</p>}
      <ErrorBox message={error} />
      {!companies && !error && <Loading />}
      {companies && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Código do app</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {companies.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link href={`/check-on/clientes/${c.id}`} className="font-bold text-white hover:text-sky-300">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-lg font-black tracking-wider text-sky-300">{c.code ?? '—'}</td>
                  <td className="px-4 py-3"><StateBadge state={c.subscription.state} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" onClick={() => setEditing(c)}>
                      <KeyRound size={14} /> Trocar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <CodeDialog
          company={editing}
          onClose={() => setEditing(null)}
          onDone={(updated, message) => {
            setCompanies((list) => (list ?? []).map((c) => (c.id === updated.id ? { ...c, code: updated.code } : c)));
            setEditing(null);
            setNotice(message);
          }}
        />
      )}
    </>
  );
}
