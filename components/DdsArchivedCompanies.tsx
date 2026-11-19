'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Archive, ChevronDown, ChevronUp, RotateCcw, Trash2 } from 'lucide-react';
import { ArchiveDialog, countLines, PermanentDeleteDialog } from '@/components/archive/ArchiveDialogs';

type Archived = { id: string; name: string; document: string | null; archivedAt: string; archivedBy: string | null; users: number; meetings: number };

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/master/arquivo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Erro ${res.status}.`);
  return data;
}

/** Botão "Excluir" do cartão da empresa (arquiva). */
export function ArchiveDdsCompanyButton({ id, name, onDone }: { id: string; name: string; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid={`archive-${id}`}
        title="Excluir (arquivar)"
        className="flex items-center gap-1.5 rounded-xl border border-slate-800 px-3 py-2 text-xs font-bold text-slate-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 size={14} /> <span>Excluir</span>
      </button>
      {open && (
        <ArchiveDialog
          name={name}
          product="DDS-ON"
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            const data = await post({ action: 'archive', companyId: id });
            setOpen(false);
            onDone(data.message);
          }}
        />
      )}
    </>
  );
}

/** Lista "Empresas arquivadas" do DDS-ON: restaurar ou excluir definitivamente. */
export function DdsArchivedCompanies({ refreshKey, onChanged }: { refreshKey: number; onChanged: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<Archived[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ company: Archived; lines: string[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/master/arquivo', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao carregar.');
      setCompanies(data.companies);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const restore = async (c: Archived) => {
    setBusyId(c.id);
    try {
      const data = await post({ action: 'restore', companyId: c.id });
      await load();
      onChanged(data.keyWarning ? `${data.message} ${data.keyWarning}` : data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao restaurar.');
    } finally {
      setBusyId(null);
    }
  };

  const askDelete = async (c: Archived) => {
    setBusyId(c.id);
    try {
      const { preview } = await post({ action: 'preview', companyId: c.id });
      const n = preview.counts;
      setDeleting({
        company: c,
        lines: countLines([
          [n.users, 'usuário (técnico/gestor)', 'usuários (técnicos/gestores)'],
          [n.meetings, 'DDS', 'DDS'],
          [n.attendances, 'presença (com assinatura e foto)', 'presenças (com assinatura e foto)'],
          [n.actionPlans, 'plano de ação', 'planos de ação'],
          [n.competitions, 'competição', 'competições'],
          [n.schedules, 'programação de DDS semanal', 'programações de DDS semanal'],
          [n.collaborators, 'colaborador cadastrado', 'colaboradores cadastrados'],
        ]),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao consultar.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60">
      <button onClick={() => setOpen((v) => !v)} data-testid="toggle-archived" className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
          <Archive size={16} className="text-slate-500" /> Empresas arquivadas ({companies.length})
        </span>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-900 p-4">
          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
          {companies.length === 0 && <p className="text-xs text-slate-500">Nenhuma empresa arquivada.</p>}
          {companies.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{c.name}</p>
                <p className="text-[11px] text-slate-500">
                  Arquivada em {new Date(c.archivedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                  {c.archivedBy ? ` por ${c.archivedBy}` : ''} · {c.users} usuário(s) · {c.meetings} DDS
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => restore(c)}
                  disabled={busyId === c.id}
                  data-testid={`restore-${c.id}`}
                  className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-600/10 px-3 py-2 text-xs font-bold text-green-400 hover:bg-green-600/20 disabled:opacity-50"
                >
                  <RotateCcw size={14} /> Restaurar
                </button>
                <button
                  onClick={() => askDelete(c)}
                  disabled={busyId === c.id}
                  data-testid={`delete-${c.id}`}
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 size={14} /> Excluir definitivamente
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {deleting && (
        <PermanentDeleteDialog
          name={deleting.company.name}
          lines={deleting.lines}
          onClose={() => setDeleting(null)}
          onConfirm={async (typedName) => {
            const data = await post({ action: 'delete', companyId: deleting.company.id, confirmName: typedName });
            setDeleting(null);
            await load();
            onChanged(data.message);
          }}
        />
      )}
    </div>
  );
}
