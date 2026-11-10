import { NextResponse } from 'next/server';
import {
  MASTER_SESSION_COOKIE,
  MASTER_SESSION_TTL_SECONDS,
  createMasterSessionToken,
  verifyMasterSessionToken,
} from '@/lib/masterSession';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, masterKey } = body;

    // Credenciais Mestras: definidas EXCLUSIVAMENTE por variáveis de ambiente
    // (MASTER_EMAIL, MASTER_PASSWORD e MASTER_KEY) no painel da Vercel / .env.
    const MASTER_EMAIL = (process.env.MASTER_EMAIL || '').toLowerCase().trim();
    const MASTER_PASSWORD = (process.env.MASTER_PASSWORD || '').trim();
    const MASTER_SECURITY_KEY = (process.env.MASTER_KEY || '').trim().toUpperCase();

    if (!MASTER_EMAIL || !MASTER_PASSWORD) {
      console.error('[ADMIN_AUTH] MASTER_EMAIL e/ou MASTER_PASSWORD não configurados no ambiente.');
      return NextResponse.json(
        { success: false, error: 'Autenticação mestre não configurada no servidor.' },
        { status: 503 }
      );
    }

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();
    const cleanKey = String(masterKey || '').trim().toUpperCase();

    // Validação de campos
    if (!cleanEmail || !cleanPassword) {
      return NextResponse.json(
        { success: false, error: 'E-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    // Validação Segura
    const isEmailValid = cleanEmail === MASTER_EMAIL;
    const isPassValid = cleanPassword === MASTER_PASSWORD;
    const isKeyValid = !cleanKey || cleanKey === MASTER_SECURITY_KEY;

    if (isEmailValid && isPassValid && isKeyValid) {
      const session = {
        id: 'master-owner-01',
        email: MASTER_EMAIL,
        name: 'Alexandre Machado',
        role: 'SUPER_ADMIN_MASTER',
        token: 'cookie',
        authenticatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      console.info(`[ADMIN_AUTH] Login mestre autorizado para ${cleanEmail} em ${new Date().toISOString()}`);

      const res = NextResponse.json({
        success: true,
        message: 'Autenticação mestre realizada com sucesso.',
        session
      });
      res.cookies.set(MASTER_SESSION_COOKIE, await createMasterSessionToken(MASTER_EMAIL), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: MASTER_SESSION_TTL_SECONDS,
      });
      return res;
    }

    console.warn(`[ADMIN_AUTH] Tentativa de login mestre inválida para ${cleanEmail} em ${new Date().toISOString()}`);

    return NextResponse.json(
      { success: false, error: 'Acesso negado. Credenciais mestras incorretas.' },
      { status: 401 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no servidor de autenticação.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  // Verificação de sessão mestre (cookie HttpOnly)
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${MASTER_SESSION_COOKIE}=([^;]+)`));
  const session = await verifyMasterSessionToken(match ? decodeURIComponent(match[1]) : null);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    role: 'SUPER_ADMIN_MASTER',
    status: 'ACTIVE'
  });
}

export async function DELETE() {
  // Logout: remove o cookie de sessão
  const res = NextResponse.json({ success: true });
  res.cookies.set(MASTER_SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
