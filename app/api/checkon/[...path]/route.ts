import { NextResponse } from 'next/server';
import { checkonFetch, CheckonError } from '@/lib/checkon';
import { MASTER_SESSION_COOKIE, verifyMasterSessionToken } from '@/lib/masterSession';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Ponte entre as telas da área CHECK-ON e a API do CHECK-ON (/api/master/*).
 * Só as operações abaixo passam; a chave fica no servidor e o histórico registra o e-mail do master.
 */
const ID = '[A-Za-z0-9-]{1,64}';
const RULES: Array<[string, RegExp]> = [
  ['GET', /^summary$/],
  ['GET', /^companies$/],
  ['POST', /^companies$/],
  ['GET', new RegExp(`^companies/${ID}$`)],
  ['PATCH', new RegExp(`^companies/${ID}$`)],
  ['POST', new RegExp(`^companies/${ID}/(renew|admin-password)$`)],
  ['GET', /^history$/],
];
const ALLOWED_QUERY = ['tenantId', 'limit'];

function readCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

async function handle(req: Request, params: { path: string[] }) {
  const session = await verifyMasterSessionToken(readCookie(req, MASTER_SESSION_COOKIE));
  if (!session) return NextResponse.json({ error: 'Sessão do DDS Master ausente ou expirada. Faça login novamente.' }, { status: 401 });

  const path = (params.path || []).join('/');
  if (!RULES.some(([method, pattern]) => method === req.method && pattern.test(path))) {
    return NextResponse.json({ error: 'Operação não permitida.' }, { status: 404 });
  }

  const url = new URL(req.url);
  const query = new URLSearchParams();
  ALLOWED_QUERY.forEach((key) => {
    const value = url.searchParams.get(key);
    if (value) query.set(key, value.slice(0, 100));
  });
  const body = req.method === 'GET' ? undefined : await req.json().catch(() => ({}));

  try {
    const data = await checkonFetch(`/${path}${query.toString() ? `?${query}` : ''}`, { method: req.method, body, actor: session.sub });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof CheckonError) return NextResponse.json({ error: error.message }, { status: error.status >= 500 ? 502 : error.status });
    console.error('[API /api/checkon]', error);
    return NextResponse.json({ error: 'Erro ao falar com o CHECK-ON.' }, { status: 502 });
  }
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  return handle(req, params);
}
export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  return handle(req, params);
}
export async function PATCH(req: Request, { params }: { params: { path: string[] } }) {
  return handle(req, params);
}
