import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, masterKey } = body;

    // Credenciais Mestras (Podem ser configuradas no .env)
    const MASTER_EMAIL = (process.env.MASTER_EMAIL || 'alexandre@amtst.com.br').toLowerCase().trim();
    const MASTER_PASSWORD = (process.env.MASTER_PASSWORD || 'AMTST#Master2026').trim();
    const MASTER_SECURITY_KEY = (process.env.MASTER_KEY || 'AM2026').trim().toUpperCase();

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
        token: Buffer.from(`${cleanEmail}:${Date.now()}:${MASTER_SECURITY_KEY}`).toString('base64'),
        authenticatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      console.info(`[ADMIN_AUTH] Login mestre autorizado para ${cleanEmail} em ${new Date().toISOString()}`);

      return NextResponse.json({
        success: true,
        message: 'Autenticação mestre realizada com sucesso.',
        session
      });
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
  // Verificação de sessão mestre
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    role: 'SUPER_ADMIN_MASTER',
    status: 'ACTIVE'
  });
}
