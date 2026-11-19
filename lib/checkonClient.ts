// lib/checkonClient.ts
// Tipos, textos e chamadas da área CHECK-ON no navegador. As chamadas passam por /api/checkon
// (servidor do Master), que guarda a chave e só deixa passar as operações permitidas.

export type SubscriptionState = 'ATIVA' | 'TESTE' | 'CARENCIA' | 'VENCIDA' | 'SUSPENSA';

export interface Subscription {
  state: SubscriptionState;
  billingCycle: string;
  endsAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number | null;
  blocksAccess: boolean;
}

export interface Usage {
  users: number;
  employees: number;
  vehicles: number;
  inspections30d: number;
  lastInspectionAt: string | null;
  openNcs: number;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  code: string | null;
  plan: string;
  isActive: boolean;
  billingCycle: string;
  subscriptionEndsAt: string | null;
  graceDays: number;
  notes: string | null;
  createdAt: string;
  subscription: Subscription;
  usage: Usage;
}

export interface HistoryEntry {
  id: string;
  action: string;
  actor: string | null;
  details: unknown;
  createdAt: string;
  tenant: { id: string; name: string } | null;
}

export interface CompanyDetail extends Company {
  admins: Array<{ id: string; name: string; email: string; isActive: boolean; mustChangePassword: boolean; createdAt: string }>;
  history: HistoryEntry[];
}

export interface Summary {
  totalCompanies: number;
  byState: Record<SubscriptionState, number>;
  expiringIn7Days: number;
  expiringSoon: Array<{ id: string; name: string; code: string | null; subscription: Subscription }>;
  inspections30d: number;
  vehicles: number;
}

export class CheckonRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Chamada à API do CHECK-ON pelo servidor do Master. Sessão expirada: volta para o login. */
export async function checkon<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/checkon/${path}`, {
    method: init.method || 'GET',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && /Sessão do DDS Master/.test(data?.error || '')) {
    window.location.assign('/login');
  }
  if (!res.ok) throw new CheckonRequestError(data?.error || `Erro ${res.status}.`, res.status);
  return data as T;
}

export const STATE_LABEL: Record<SubscriptionState, string> = {
  ATIVA: 'Ativa',
  TESTE: 'Em teste',
  CARENCIA: 'Em carência',
  VENCIDA: 'Vencida',
  SUSPENSA: 'Suspensa',
};

export const STATE_STYLE: Record<SubscriptionState, string> = {
  ATIVA: 'bg-green-500/15 text-green-300 border-green-500/30',
  TESTE: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  CARENCIA: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  VENCIDA: 'bg-red-500/15 text-red-300 border-red-500/30',
  SUSPENSA: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

export const CYCLE_LABEL: Record<string, string> = { TESTE: 'Teste', MENSAL: 'Mensal', ANUAL: 'Anual' };

export const ACTION_LABEL: Record<string, string> = {
  COMPANY_CREATED: 'Cliente criado',
  COMPANY_UPDATED: 'Dados alterados',
  CODE_CHANGED: 'Código do app trocado',
  COMPANY_SUSPENDED: 'Cliente suspenso',
  COMPANY_REACTIVATED: 'Cliente reativado',
  SUBSCRIPTION_RENEWED: 'Assinatura renovada',
  ADMIN_PASSWORD_RESET: 'Nova senha do administrador',
};

/** Data no calendário de Brasília. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

/** "2026-12-19" do vencimento (no fuso de Brasília), para o campo de data. */
export function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const local = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/** Texto curto do prazo: "vence hoje", "vence em 5 dias", "venceu há 3 dias", "sem vencimento". */
export function deadlineText(s: Subscription): string {
  if (s.state === 'SUSPENSA') return 'suspensa';
  if (s.daysLeft === null) return 'sem vencimento';
  if (s.daysLeft === 0) return 'vence hoje';
  if (s.daysLeft === 1) return 'vence amanhã';
  if (s.daysLeft > 1) return `vence em ${s.daysLeft} dias`;
  const days = -s.daysLeft;
  return `venceu há ${days} dia${days === 1 ? '' : 's'}`;
}

export function formatCnpj(cnpj: string | null): string {
  if (!cnpj || cnpj.length !== 14) return cnpj || '—';
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/** Código do app como o CHECK-ON aceita: 3 a 12 letras ou números, sem espaço. */
export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

/** Endereço do portal do CHECK-ON (vai junto com as credenciais do administrador). */
export const PORTAL_URL = process.env.NEXT_PUBLIC_CHECKON_PORTAL_URL || 'https://check-on-mu.vercel.app';
