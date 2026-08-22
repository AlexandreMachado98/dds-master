 import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, masterKey } = body;

    // Credenciais Mestras (Podem ser configuradas no .env na Vercel)
    const MASTER_EMAIL = process.env.MASTER_EMAIL || 'alexandre@amtst.com.br';
    const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'AMTST#Master2026';
    const MASTER_SECURITY_KEY = process.env.MASTER_KEY || 'AM2026';

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();
    const cleanKey = String(masterKey || '').trim().toUpperCase();

    // Validação Segura
    const isEmailValid = cleanEmail === MASTER_EMAIL.toLowerCase();
    const isPassValid = cleanPassword === MASTER_PASSWORD;
    const isKeyValid = !cleanKey || cleanKey === MASTER_SECURITY_KEY;

    if (isEmailValid && isPassValid && isKeyValid) {
      const session = {
        id: 'master-owner-01',
        email: MASTER_EMAIL,
        name: 'Alexandre Machado',
        role: 'SUPER_ADMIN_MASTER',
        token: Buffer.from(`${cleanEmail}:${Date.now()}`).toString('base64'),
        authenticatedAt: new Date().toISOString()
      };

      return NextResponse.json({ success: true, session });
    }

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