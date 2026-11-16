// middleware.ts
// Toda tela e toda rota da API do DDS Master exigem a sessão mestre assinada.
// Ficam abertas só a tela de login, a rota de login e os arquivos estáticos.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MASTER_SESSION_COOKIE, verifyMasterSessionToken } from '@/lib/masterSession';

const PUBLIC_PATHS = new Set(['/login', '/api/master/auth']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = await verifyMasterSessionToken(request.cookies.get(MASTER_SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Sessão do DDS Master ausente ou expirada. Faça login novamente.' }, { status: 401 });
  }
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Tudo, menos arquivos estáticos do Next e da pasta public.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|logo.jpg|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)']
};
