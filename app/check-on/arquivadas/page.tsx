'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RotateCcw, Trash2 } from 'lucide-react';
import { checkon, formatDateTime, type Company } from '@/lib/checkonClient';
import { Button, ErrorBox, Loading, PageTitle } from '@/components/checkon/ui';
import { countLines, PermanentDeleteDialog } from '@/components/archive/ArchiveDialogs';

/** Clientes do CHECK-ON arquivados ("Excluir"): restaurar ou excluir definitivamente. */
function Archived() {
  const params = useSearchParams();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => {
    const name = params.get('excluida');
    return name ? `Cliente "${name}" excluído definitivamente.` : null;
  });
  const [deleting, setDeleting] = useState<{ company: Company; lines: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    checkon<Company[]>('companies?archived=true').then(setCompanies).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const restore = async (c: Company) => {
    setBusy(c.id);
    try {
      await checkon(`companies/${c.id}/restore`, { method: 'POST' });
      setNotice(`Cliente "${c.name}" restaurado. O acesso voltou como estava antes.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao restaurar.');
    } finally {
      setBusy(null);
    }
  };

  const askDelete = async (c: Company) => {
    setBusy(c.id);
    try {
      const { counts: n } = await checkon<{ counts: Record<string, number> }>(`companies/${c.id}/deletion-preview`);
      setDeleting({
        company: c,
        lines: countLines([
          [n.users, 'login (portal/app)', 'logins (portal/app)'],
          [n.employees, 'colaborador', 'colaboradores'],
          [n.vehicles, 'veículo', 'veículos'],
          [n.checklists, 'inspeção', 'inspeções'],
          [n.ncs, 'não conformidade', 'não conformidades'],
          [n.photos, 'foto de inspeção', 'fotos de inspeção'],
        ]),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao consultar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle title="Clientes arquivados" subtitle='Clientes "excluídos": ninguém entra, mas os dados estão guardados. Restaure ou exclua de vez.' />
      {notice && <p role="status" className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">{notice}</p>}
      <ErrorBox message={error} />
      {!companies && !error && <Loading />}
      {companies && companies.length === 0 && <p className="text-sm text-slate-400">Nenhum cliente arquivado.</p>}
      <div className="space-y-3">
        {companies?.map((c) => (
          <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link href={`/check-on/clientes/${c.id}`} className="font-bold text-white hover:text-sky-300">{c.name}</Link>
              <p className="text-xs text-slate-400">
                Código {c.code ?? '—'} · arquivado em {formatDateTime(c.archivedAt)} · {c.usage.vehicles} veículo(s) · {c.usage.employees} colaborador(es)
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="success" onClick={() => restore(c)} loading={busy === c.id} testId={`restore-${c.id}`}><RotateCcw size={16} /> Restaurar</Button>
              <Button variant="danger" onClick={() => askDelete(c)} disabled={busy === c.id} testId={`delete-${c.id}`}><Trash2 size={16} /> Excluir definitivamente</Button>
            </div>
          </div>
        ))}
      </div>
      {deleting && (
        <PermanentDeleteDialog
          name={deleting.company.name}
          lines={deleting.lines}
          onClose={() => setDeleting(null)}
          onConfirm={async (confirmName) => {
            await checkon(`companies/${deleting.company.id}`, { method: 'DELETE', body: { confirmName } });
            setNotice(`Cliente "${deleting.company.name}" excluído definitivamente.`);
            setDeleting(null);
            load();
          }}
        />
      )}
    </>
  );
}

export default function ArchivedPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Archived />
    </Suspense>
  );
}
