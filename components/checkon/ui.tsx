'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { Check, Copy, Loader2, X } from 'lucide-react';
import { STATE_LABEL, STATE_STYLE, type SubscriptionState } from '@/lib/checkonClient';

export function StateBadge({ state }: { state: SubscriptionState }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATE_STYLE[state]}`}>
      {STATE_LABEL[state]}
    </span>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">{title}</h2>}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  loading,
  type = 'button',
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  testId?: string;
}) {
  const styles = {
    primary: 'bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:from-sky-500 hover:to-blue-500 shadow-lg shadow-sky-600/20',
    outline: 'border border-slate-700 text-slate-200 hover:bg-slate-800',
    danger: 'border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20',
    success: 'border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      data-testid={testId}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export const inputClass =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</p>;
}

export function Loading({ text = 'Carregando...' }: { text?: string }) {
  return (
    <p className="flex items-center gap-2 py-10 text-sm text-slate-400">
      <Loader2 size={16} className="animate-spin" /> {text}
    </p>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label={title} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

/** Credenciais mostradas uma única vez (senha provisória). */
export function CredentialsBox({ lines }: { lines: Array<[string, string]> }) {
  const [copied, setCopied] = useState(false);
  const text = lines.map(([label, value]) => `${label}: ${value}`).join('\n');
  return (
    <div className="space-y-3">
      <div data-testid="credentials" className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 font-mono text-sm">
        {lines.map(([label, value]) => (
          <p key={label}>
            <span className="text-slate-400">{label}:</span> <span className="font-bold text-white">{value}</span>
          </p>
        ))}
      </div>
      <p className="text-xs text-amber-300">A senha provisória não aparece de novo. No primeiro acesso ao portal, o administrador cria uma senha própria.</p>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar dados'}
      </Button>
    </div>
  );
}
