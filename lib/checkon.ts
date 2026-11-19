// lib/checkon.ts
// Cliente da API do CHECK-ON para o DDS Master (só no servidor: a chave nunca vai para o navegador).
// O CHECK-ON tem banco próprio; o Master não acessa esse banco, só esta API (/api/master/*).

export interface CheckonConfig {
  ready: boolean;
  url: string;
  token: string;
  problems: string[];
}

export function checkonConfig(): CheckonConfig {
  const url = (process.env.CHECKON_API_URL || '').trim().replace(/\/+$/, '');
  const token = (process.env.CHECKON_MASTER_TOKEN || '').trim();
  const problems: string[] = [];
  if (!/^https?:\/\//.test(url)) problems.push('CHECKON_API_URL ausente (ex.: https://check-on-mu.vercel.app/api)');
  if (token.length < 32) problems.push('CHECKON_MASTER_TOKEN ausente ou com menos de 32 caracteres');
  return { ready: problems.length === 0, url, token, problems };
}

export class CheckonError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; actor?: string; timeoutMs?: number };

/** Chamada à API do CHECK-ON. Erros viram CheckonError com a mensagem em português da própria API. */
export async function checkonFetch<T>(path: string, options: Options = {}): Promise<T> {
  const config = checkonConfig();
  if (!config.ready) throw new CheckonError(`Integração com o CHECK-ON não configurada: ${config.problems.join('; ')}.`, 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  let res: Response;
  try {
    res = await fetch(`${config.url}/master${path}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.actor ? { 'X-Master-Actor': options.actor } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    throw new CheckonError('Não foi possível falar com o CHECK-ON (fora do ar ou endereço errado).', 502);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(' ') : data?.message || `Erro ${res.status} no CHECK-ON.`;
    throw new CheckonError(message, res.status);
  }
  return data as T;
}
