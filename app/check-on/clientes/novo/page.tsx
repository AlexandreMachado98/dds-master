'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { checkon, normalizeCode, PORTAL_URL, type CompanyDetail } from '@/lib/checkonClient';
import { Button, CredentialsBox, ErrorBox, Field, inputClass, PageTitle, Panel } from '@/components/checkon/ui';

type Created = { company: CompanyDetail; credentials: { companyCode: string; adminEmail: string; temporaryPassword: string } };

/** Novo cliente do CHECK-ON: empresa, assinatura, código do app e administrador. */
export default function NewClientPage() {
  const [form, setForm] = useState({
    name: '',
    cnpj: '',
    code: '',
    billingCycle: 'TESTE',
    trialDays: 15,
    subscriptionEndsAt: '',
    graceDays: 5,
    adminName: '',
    adminEmail: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const set = (key: keyof typeof form, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        code: form.code,
        billingCycle: form.billingCycle,
        graceDays: Number(form.graceDays),
        adminName: form.adminName,
        adminEmail: form.adminEmail,
      };
      if (form.cnpj.trim()) body.cnpj = form.cnpj;
      if (form.notes.trim()) body.notes = form.notes;
      if (form.subscriptionEndsAt) body.subscriptionEndsAt = form.subscriptionEndsAt;
      else if (form.billingCycle === 'TESTE') body.trialDays = Number(form.trialDays);
      setCreated(await checkon<Created>('companies', { method: 'POST', body }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar o cliente.');
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <>
        <PageTitle title="Cliente criado" subtitle={created.company.name} />
        <Panel title="Envie estes dados ao cliente">
          <CredentialsBox
            lines={[
              ['Portal', PORTAL_URL],
              ['E-mail do administrador', created.credentials.adminEmail],
              ['Senha provisória', created.credentials.temporaryPassword],
              ['Código da empresa no aplicativo', created.credentials.companyCode],
            ]}
          />
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/check-on/clientes/${created.company.id}`}><Button>Abrir a ficha do cliente</Button></Link>
            <Link href="/check-on/clientes"><Button variant="outline">Voltar aos clientes</Button></Link>
          </div>
        </Panel>
      </>
    );
  }

  const automaticEnd =
    form.billingCycle === 'TESTE' ? `hoje + ${form.trialDays} dias de teste` : form.billingCycle === 'ANUAL' ? 'hoje + 12 meses' : 'hoje + 1 mês';

  return (
    <>
      <Link href="/check-on/clientes" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={16} /> Clientes
      </Link>
      <PageTitle title="Novo cliente" subtitle="Cria a empresa no CHECK-ON, já com o administrador e o código do aplicativo." />
      <form onSubmit={submit} className="space-y-6">
        <Panel title="Empresa">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da empresa">
              <input className={inputClass} required maxLength={120} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="CNPJ (opcional)">
              <input className={inputClass} inputMode="numeric" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} />
            </Field>
            <Field label="Código da empresa no aplicativo" hint="É o que os motoristas digitam no app. De 3 a 12 letras ou números.">
              <input
                className={`${inputClass} font-mono uppercase tracking-wider`}
                required
                placeholder="EX.: VISTECSSQV"
                value={form.code}
                onChange={(e) => set('code', normalizeCode(e.target.value))}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Assinatura">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo">
              <select className={inputClass} value={form.billingCycle} onChange={(e) => set('billingCycle', e.target.value)}>
                <option value="TESTE">Teste grátis</option>
                <option value="MENSAL">Mensal</option>
                <option value="ANUAL">Anual</option>
              </select>
            </Field>
            {form.billingCycle === 'TESTE' && (
              <Field label="Dias de teste">
                <input className={inputClass} type="number" min={1} max={90} value={form.trialDays} onChange={(e) => set('trialDays', e.target.value)} />
              </Field>
            )}
            <Field label="Vencimento (opcional)" hint={`Em branco: ${automaticEnd}.`}>
              <input className={inputClass} type="date" value={form.subscriptionEndsAt} onChange={(e) => set('subscriptionEndsAt', e.target.value)} />
            </Field>
            <Field label="Dias de carência" hint="Depois do vencimento, o cliente continua usando por estes dias, com aviso no portal.">
              <input className={inputClass} type="number" min={0} max={60} value={form.graceDays} onChange={(e) => set('graceDays', e.target.value)} />
            </Field>
          </div>
        </Panel>

        <Panel title="Administrador da empresa">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <input className={inputClass} required maxLength={120} value={form.adminName} onChange={(e) => set('adminName', e.target.value)} />
            </Field>
            <Field label="E-mail" hint="Ele entra no portal com este e-mail e uma senha provisória.">
              <input className={inputClass} type="email" required value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} />
            </Field>
          </div>
        </Panel>

        <Panel title="Anotações internas (opcional)">
          <textarea className={`${inputClass} min-h-20`} maxLength={2000} placeholder="Só aparece aqui no Master." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Panel>

        <ErrorBox message={error} />
        <div className="flex gap-2">
          <Button type="submit" loading={saving} testId="create-client">Criar cliente</Button>
          <Link href="/check-on/clientes"><Button variant="outline">Cancelar</Button></Link>
        </div>
      </form>
    </>
  );
}
