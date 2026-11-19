'use client';

import React, { useState } from 'react';
import { checkon, normalizeCode, type Company, type CompanyDetail } from '@/lib/checkonClient';
import { Button, ErrorBox, Field, inputClass, Modal } from '@/components/checkon/ui';

export type DialogProps = { company: Company; onClose: () => void; onDone: (c: CompanyDetail, message: string) => void };

/** Envio com estado de "salvando" e erro, comum a todas as janelas. */
export function useSubmit() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run };
}


export function CodeDialog({ company, onClose, onDone }: DialogProps) {
  const [code, setCode] = useState(company.code ?? '');
  const { saving, error, run } = useSubmit();
  return (
    <Modal title="Trocar código do aplicativo" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Novo código" hint="De 3 a 12 letras ou números. Precisa ser único entre os clientes.">
          <input data-testid="code-input" className={`${inputClass} font-mono uppercase tracking-wider`} value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} />
        </Field>
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Quem já está conectado no app continua trabalhando. Para entrar de novo, os motoristas vão precisar do código novo: avise o cliente.
        </p>
        <ErrorBox message={error} />
        <div className="flex gap-2 pt-2">
          <Button
            loading={saving}
            testId="confirm-code"
            disabled={code.length < 3 || code === company.code}
            onClick={() =>
              run(async () => {
                const updated = await checkon<CompanyDetail>(`companies/${company.id}`, { method: 'PATCH', body: { code } });
                onDone(updated, `Código do aplicativo trocado para ${updated.code}.`);
              })
            }
          >
            Trocar código
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

