'use client';

import React, { useState } from 'react';
import { AlertTriangle, Archive, Loader2, Trash2, X } from 'lucide-react';

/** Janela simples (escura), usada nas duas áreas (DDS-ON e CHECK-ON). */
function Shell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label={title} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** "Excluir" = arquivar (reversível). */
export function ArchiveDialog({
  name,
  product,
  onConfirm,
  onClose,
}: {
  name: string;
  product: 'DDS-ON' | 'CHECK-ON';
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { busy, error, run } = useRun();
  return (
    <Shell title={`Excluir ${name}?`} onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-300">
        <p>A empresa vai para <strong className="text-white">Arquivadas</strong>:</p>
        <ul className="list-disc space-y-1 pl-5 text-slate-400">
          <li>some das listas do {product};</li>
          <li>ninguém da empresa entra mais {product === 'CHECK-ON' ? 'no portal nem no aplicativo' : 'no DDS-ON (técnicos bloqueados e palavra-chave desativada)'};</li>
          <li><strong className="text-slate-200">nenhum dado é apagado</strong>: dá para restaurar exatamente como estava.</li>
        </ul>
        <p className="text-xs text-slate-500">Para apagar de vez, use "Excluir definitivamente" na lista de arquivadas.</p>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button
          data-testid="confirm-archive"
          disabled={busy}
          onClick={() => run(onConfirm)}
          className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />} Excluir (arquivar)
        </button>
        <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-800">
          Cancelar
        </button>
      </div>
    </Shell>
  );
}

/** Exclusão definitiva: mostra o que será apagado e pede o nome da empresa. */
export function PermanentDeleteDialog({
  name,
  lines,
  onConfirm,
  onClose,
}: {
  name: string;
  /** Ex.: ["12 usuários", "6 inspeções", "2 fotos"]. */
  lines: string[];
  onConfirm: (typedName: string) => Promise<void>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const { busy, error, run } = useRun();
  const matches = typed.trim().toLocaleLowerCase('pt-BR') === name.trim().toLocaleLowerCase('pt-BR');
  return (
    <Shell title="Excluir definitivamente" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-red-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            Isto apaga <strong>{name}</strong> e todos os dados dela, <strong>sem volta</strong>. Se forem registros de segurança do trabalho
            (DDS, presenças, inspeções), confirme antes que não precisa mais guardá-los.
          </span>
        </p>
        {lines.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">Será apagado:</p>
            <ul data-testid="delete-preview" className="list-disc space-y-0.5 pl-5 text-slate-300">
              {lines.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        )}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-300">Para confirmar, digite o nome da empresa: <strong className="text-white">{name}</strong></span>
          <input
            data-testid="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
          />
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button
          data-testid="confirm-delete"
          disabled={!matches || busy}
          onClick={() => run(() => onConfirm(typed))}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Excluir definitivamente
        </button>
        <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-800">
          Cancelar
        </button>
      </div>
    </Shell>
  );
}

/** "3 usuários" / "1 usuário": só mostra contagens maiores que zero. */
export function countLines(entries: Array<[number, string, string]>): string[] {
  return entries.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
}
