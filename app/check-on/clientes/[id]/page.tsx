'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ban, CalendarPlus, KeyRound, Pencil, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  ACTION_LABEL,
  checkon,
  CYCLE_LABEL,
  dateInputValue,
  deadlineText,
  formatCnpj,
  formatDate,
  formatDateTime,
  PORTAL_URL,
  type CompanyDetail,
} from '@/lib/checkonClient';
import { Button, CredentialsBox, ErrorBox, Field, inputClass, Loading, Modal, PageTitle, Panel, StateBadge } from '@/components/checkon/ui';
import { CodeDialog, useSubmit, type DialogProps } from '@/components/checkon/dialogs';

type Dialog = null | 'edit' | 'renew' | 'code' | 'suspend' | 'reactivate' | 'password';

/** Ficha do cliente: assinatura, código do app, administradores, uso e histórico. */
export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCompany(await checkon<CompanyDetail>(`companies/${id}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar o cliente.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const done = (updated: CompanyDetail, message: string) => {
    setCompany(updated);
    setDialog(null);
    setNotice(message);
    setTimeout(() => setNotice(null), 5000);
  };

  if (!company) {
    return (
      <>
        <BackLink />
        {error ? <ErrorBox message={error} /> : <Loading />}
      </>
    );
  }

  const s = company.subscription;
  return (
    <>
      <BackLink />
      <PageTitle
        title={company.name}
        subtitle={`CNPJ ${formatCnpj(company.cnpj)} · cliente desde ${formatDate(company.createdAt)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog('edit')}><Pencil size={16} /> Editar</Button>
            {company.isActive ? (
              <Button variant="danger" onClick={() => setDialog('suspend')} testId="suspend"><Ban size={16} /> Suspender</Button>
            ) : (
              <Button variant="success" onClick={() => setDialog('reactivate')} testId="reactivate"><RotateCcw size={16} /> Reativar</Button>
            )}
          </>
        }
      />
      {notice && <p role="status" className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">{notice}</p>}
      <ErrorBox message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Assinatura" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <StateBadge state={s.state} />
            <span className="text-sm text-slate-300">{CYCLE_LABEL[s.billingCycle] ?? s.billingCycle}</span>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <Info label="Vencimento" value={formatDate(s.endsAt)} detail={deadlineText(s)} testId="ends-at" />
            <Info label="Carência" value={`${company.graceDays} dia(s)`} detail={s.graceEndsAt ? `até ${formatDate(s.graceEndsAt)}` : undefined} />
            <Info label="Acesso" value={s.blocksAccess ? 'Bloqueado' : 'Liberado'} detail={s.state === 'CARENCIA' ? 'com aviso no portal' : undefined} />
          </dl>
          {s.state === 'SUSPENSA' && <p className="mt-4 text-sm text-slate-400">Suspenso: ninguém da empresa entra no portal nem no aplicativo. Os dados continuam guardados.</p>}
          {s.state === 'VENCIDA' && <p className="mt-4 text-sm text-red-300">Vencida: portal e aplicativo bloqueados até a renovação. Os dados continuam guardados.</p>}
          <div className="mt-5">
            <Button onClick={() => setDialog('renew')} testId="renew"><CalendarPlus size={16} /> Renovar</Button>
          </div>
        </Panel>

        <Panel title="Código do aplicativo">
          <p data-testid="app-code" className="font-mono text-3xl font-black tracking-wider text-sky-300">{company.code ?? '—'}</p>
          <p className="mt-2 text-xs text-slate-400">Os motoristas entram no app com este código e a matrícula.</p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => setDialog('code')} testId="change-code"><KeyRound size={16} /> Trocar código</Button>
          </div>
        </Panel>

        <Panel title="Uso" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info label="Veículos ativos" value={String(company.usage.vehicles)} />
            <Info label="Colaboradores ativos" value={String(company.usage.employees)} />
            <Info label="Logins ativos" value={String(company.usage.users)} />
            <Info label="Inspeções (30 dias)" value={String(company.usage.inspections30d)} />
            <Info label="NCs em aberto" value={String(company.usage.openNcs)} />
            <Info label="Última inspeção" value={formatDateTime(company.usage.lastInspectionAt)} />
          </dl>
        </Panel>

        <Panel title="Administradores">
          {company.admins.length === 0 && <p className="text-sm text-slate-400">Nenhum administrador.</p>}
          <ul className="space-y-3">
            {company.admins.map((a) => (
              <li key={a.id} className="text-sm">
                <p className="font-bold text-white">{a.name}</p>
                <p className="text-xs text-slate-400">{a.email}{!a.isActive ? ' · bloqueado' : a.mustChangePassword ? ' · aguardando 1º acesso' : ''}</p>
              </li>
            ))}
          </ul>
          {company.admins.length > 0 && (
            <div className="mt-4">
              <Button variant="outline" onClick={() => setDialog('password')} testId="admin-password"><ShieldCheck size={16} /> Nova senha do administrador</Button>
            </div>
          )}
        </Panel>

        {company.notes && (
          <Panel title="Anotações internas" className="lg:col-span-3">
            <p className="whitespace-pre-wrap text-sm text-slate-300">{company.notes}</p>
          </Panel>
        )}

        <Panel title="Histórico" className="lg:col-span-3">
          {company.history.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma ação registrada.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {company.history.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                  <span className="font-semibold text-slate-200">{ACTION_LABEL[h.action] ?? h.action}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(h.createdAt)}{h.actor ? ` · ${h.actor}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {dialog === 'edit' && <EditDialog company={company} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'renew' && <RenewDialog company={company} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'code' && <CodeDialog company={company} onClose={() => setDialog(null)} onDone={done} />}
      {(dialog === 'suspend' || dialog === 'reactivate') && (
        <StatusDialog company={company} suspend={dialog === 'suspend'} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog === 'password' && <PasswordDialog company={company} onClose={() => { setDialog(null); load(); }} />}
    </>
  );
}

function BackLink() {
  return (
    <Link href="/check-on/clientes" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
      <ArrowLeft size={16} /> Clientes
    </Link>
  );
}

function Info({ label, value, detail, testId }: { label: string; value: string; detail?: string; testId?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd data-testid={testId} className="mt-0.5 font-bold text-white">{value}</dd>
      {detail && <dd className="text-xs text-slate-400">{detail}</dd>}
    </div>
  );
}


function EditDialog({ company, onClose, onDone }: DialogProps) {
  const [form, setForm] = useState({
    name: company.name,
    cnpj: company.cnpj ?? '',
    billingCycle: company.billingCycle,
    subscriptionEndsAt: dateInputValue(company.subscriptionEndsAt),
    graceDays: company.graceDays,
    notes: company.notes ?? '',
  });
  const { saving, error, run } = useSubmit();
  const set = (key: keyof typeof form, value: string | number) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <Modal title="Editar cliente" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nome"><input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="CNPJ"><input className={inputClass} value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} placeholder="Em branco remove" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select className={inputClass} value={form.billingCycle} onChange={(e) => set('billingCycle', e.target.value)}>
              <option value="TESTE">Teste</option>
              <option value="MENSAL">Mensal</option>
              <option value="ANUAL">Anual</option>
            </select>
          </Field>
          <Field label="Dias de carência">
            <input className={inputClass} type="number" min={0} max={60} value={form.graceDays} onChange={(e) => set('graceDays', e.target.value)} />
          </Field>
        </div>
        <Field label="Vencimento" hint="Em branco: sem vencimento (nunca bloqueia).">
          <input className={inputClass} type="date" value={form.subscriptionEndsAt} onChange={(e) => set('subscriptionEndsAt', e.target.value)} />
        </Field>
        <Field label="Anotações internas"><textarea className={`${inputClass} min-h-20`} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <ErrorBox message={error} />
        <div className="flex gap-2 pt-2">
          <Button
            loading={saving}
            onClick={() =>
              run(async () => {
                const updated = await checkon<CompanyDetail>(`companies/${company.id}`, {
                  method: 'PATCH',
                  body: {
                    name: form.name,
                    cnpj: form.cnpj,
                    billingCycle: form.billingCycle,
                    subscriptionEndsAt: form.subscriptionEndsAt || null,
                    graceDays: Number(form.graceDays),
                    notes: form.notes,
                  },
                });
                onDone(updated, 'Dados do cliente atualizados.');
              })
            }
          >
            Salvar
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

function RenewDialog({ company, onClose, onDone }: DialogProps) {
  const [mode, setMode] = useState<'1' | '12' | 'date'>(company.billingCycle === 'ANUAL' ? '12' : '1');
  const [until, setUntil] = useState('');
  const { saving, error, run } = useSubmit();
  const s = company.subscription;
  const base = s.endsAt && s.daysLeft !== null && s.daysLeft >= 0 ? `a partir do vencimento atual (${formatDate(s.endsAt)})` : 'a partir de hoje';
  return (
    <Modal title="Renovar assinatura" onClose={onClose}>
      <div className="space-y-3">
        {(['1', '12'] as const).map((m) => (
          <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${mode === m ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800'}`}>
            <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
            <span>
              <span className="font-bold text-white">{m === '1' ? '+1 mês (mensal)' : '+12 meses (anual)'}</span>
              <span className="block text-xs text-slate-400">Soma {base}.</span>
            </span>
          </label>
        ))}
        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${mode === 'date' ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800'}`}>
          <input type="radio" checked={mode === 'date'} onChange={() => setMode('date')} />
          <span className="flex-1">
            <span className="font-bold text-white">Escolher a data</span>
            {mode === 'date' && <input className={`${inputClass} mt-2`} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />}
          </span>
        </label>
        <ErrorBox message={error} />
        <div className="flex gap-2 pt-2">
          <Button
            loading={saving}
            testId="confirm-renew"
            disabled={mode === 'date' && !until}
            onClick={() =>
              run(async () => {
                const body = mode === 'date' ? { until } : { months: Number(mode), billingCycle: mode === '12' ? 'ANUAL' : 'MENSAL' };
                const updated = await checkon<CompanyDetail>(`companies/${company.id}/renew`, { method: 'POST', body });
                onDone(updated, `Assinatura renovada até ${formatDate(updated.subscription.endsAt)}. O acesso foi liberado na hora.`);
              })
            }
          >
            Renovar
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

function StatusDialog({ company, suspend, onClose, onDone }: DialogProps & { suspend: boolean }) {
  const { saving, error, run } = useSubmit();
  return (
    <Modal title={suspend ? `Suspender ${company.name}?` : `Reativar ${company.name}?`} onClose={onClose}>
      <p className="text-sm text-slate-300">
        {suspend
          ? 'Ninguém da empresa entra mais no portal nem no aplicativo, e quem estiver conectado sai em até 30 segundos. Nada é apagado: ao reativar, tudo volta como estava.'
          : 'O acesso ao portal e ao aplicativo é liberado na hora (se a assinatura estiver em dia).'}
      </p>
      <ErrorBox message={error} />
      <div className="mt-5 flex gap-2">
        <Button
          variant={suspend ? 'danger' : 'success'}
          loading={saving}
          testId="confirm-status"
          onClick={() =>
            run(async () => {
              const updated = await checkon<CompanyDetail>(`companies/${company.id}`, { method: 'PATCH', body: { isActive: !suspend } });
              onDone(updated, suspend ? 'Cliente suspenso.' : 'Cliente reativado.');
            })
          }
        >
          {suspend ? 'Suspender' : 'Reativar'}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </Modal>
  );
}

function PasswordDialog({ company, onClose }: { company: CompanyDetail; onClose: () => void }) {
  const [userId, setUserId] = useState(company.admins.find((a) => a.isActive)?.id ?? company.admins[0]?.id ?? '');
  const [credentials, setCredentials] = useState<{ adminEmail: string; temporaryPassword: string } | null>(null);
  const { saving, error, run } = useSubmit();
  return (
    <Modal title="Nova senha do administrador" onClose={onClose}>
      {credentials ? (
        <CredentialsBox
          lines={[
            ['Portal', PORTAL_URL],
            ['E-mail', credentials.adminEmail],
            ['Senha provisória', credentials.temporaryPassword],
          ]}
        />
      ) : (
        <div className="space-y-3">
          <Field label="Administrador">
            <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
              {company.admins.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-slate-400">A senha atual deixa de funcionar e o administrador sai dos aparelhos conectados. Se o acesso dele estava bloqueado, é liberado.</p>
          <ErrorBox message={error} />
          <div className="flex gap-2 pt-2">
            <Button
              loading={saving}
              testId="confirm-password"
              onClick={() =>
                run(async () => {
                  const res = await checkon<{ credentials: { adminEmail: string; temporaryPassword: string } }>(`companies/${company.id}/admin-password`, {
                    method: 'POST',
                    body: { userId },
                  });
                  setCredentials(res.credentials);
                })
              }
            >
              Gerar nova senha
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
