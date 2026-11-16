// app/api/master/auth/route.ts
// Login do DDS Master. As credenciais vêm só das variáveis de ambiente da Vercel
// (MASTER_EMAIL, MASTER_PASSWORD, MASTER_KEY e MASTER_SESSION_SECRET): não há
// valores padrão no código. Sem elas, o login fica desativado.

import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  createMasterSessionToken, verifyMasterSessionToken, masterSessionCookie, clearMasterSessionCookie,
  getMasterSessionSecret, MASTER_SESSION_COOKIE, MASTER_SESSION_TTL_SECONDS
} from '@/lib/masterSession';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Limite de tentativas por IP (5 erros a cada 15 minutos).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown').trim().slice(0, 45);
}

function isBlocked(ip: string): boolean {
  const now = Date.now();
  const recent = (failures.get(ip) || []).filter(t => now - t < WINDOW_MS);
  failures.set(ip, recent);
  return recent.length >= MAX_FAILURES;
}

function recordFailure(ip: string) {
  const list = failures.get(ip) || [];
  list.push(Date.now());
  failures.set(ip, list);
}

/** Compara textos em tempo constante (via hash, para tamanhos diferentes também). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function readConfig() {
  const email = (process.env.MASTER_EMAIL || '').toLowerCase().trim();
  const password = (process.env.MASTER_PASSWORD || '').trim();
  const key = (process.env.MASTER_KEY || '').trim().toUpperCase();
  const ready = Boolean(email && password.length >= 12 && key && getMasterSessionSecret());
  return { email, password, key, ready };
}

function readCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

export async function POST(req: Request) {
  const config = readConfig();
  if (!config.ready) {
    console.error('[ADMIN_AUTH] Login mestre desativado: variáveis MASTER_EMAIL, MASTER_PASSWORD (12+ caracteres), MASTER_KEY e MASTER_SESSION_SECRET (32+ caracteres) precisam estar configuradas.');
    return NextResponse.json(
      { success: false, error: 'O login do DDS Master não está configurado no servidor. Defina as variáveis de acesso na Vercel.' },
      { status: 503 }
    );
  }

  const ip = clientIp(req);
  if (isBlocked(ip)) {
    return NextResponse.json({ success: false, error: 'Muitas tentativas incorretas. Aguarde 15 minutos e tente de novo.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const cleanEmail = String(body?.email || '').toLowerCase().trim();
  const cleanPassword = String(body?.password || '').trim();
  const cleanKey = String(body?.masterKey || '').trim().toUpperCase();
  if (!cleanEmail || !cleanPassword || !cleanKey) {
    return NextResponse.json({ success: false, error: 'Informe e-mail, senha e chave de segurança.' }, { status: 400 });
  }

  // As três conferências rodam sempre (sem atalho), para não revelar qual falhou.
  const ok = [safeEqual(cleanEmail, config.email), safeEqual(cleanPassword, config.password), safeEqual(cleanKey, config.key)].every(Boolean);
  if (!ok) {
    recordFailure(ip);
    console.warn(`[ADMIN_AUTH] Tentativa de login mestre recusada (IP ${ip}) em ${new Date().toISOString()}`);
    return NextResponse.json({ success: false, error: 'Acesso negado. Credenciais mestras incorretas.' }, { status: 401 });
  }

  failures.delete(ip);
  const token = await createMasterSessionToken(config.email);
  if (!token) return NextResponse.json({ success: false, error: 'Falha ao criar a sessão.' }, { status: 500 });

  const now = Date.now();
  const response = NextResponse.json({
    success: true,
    message: 'Autenticação mestre realizada com sucesso.',
    // Dados só para exibição na tela; quem autoriza é o cookie HttpOnly.
    session: {
      id: 'master-owner-01',
      email: config.email,
      name: 'Administrador Master',
      role: 'SUPER_ADMIN_MASTER',
      authenticatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + MASTER_SESSION_TTL_SECONDS * 1000).toISOString()
    }
  });
  response.headers.set('Set-Cookie', masterSessionCookie(token));
  console.info(`[ADMIN_AUTH] Login mestre autorizado em ${new Date().toISOString()}`);
  return response;
}

export async function GET(req: Request) {
  const session = await verifyMasterSessionToken(readCookie(req, MASTER_SESSION_COOKIE));
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, role: 'SUPER_ADMIN_MASTER', expiresAt: new Date(session.exp * 1000).toISOString() });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearMasterSessionCookie());
  return response;
}
