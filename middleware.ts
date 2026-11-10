import { NextResponse, type NextRequest } from 'next/server';
import { MASTER_SESSION_COOKIE, verifyMasterSessionToken } from '@/lib/masterSession';

// Rotas acessíveis sem sessão mestre
const PUBLIC_PATHS = ['/login', '/api/master/auth'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const session = await verifyMasterSessionToken(req.cookies.get(MASTER_SESSION_COOKIE)?.value);
  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Sessão mestre inválida ou expirada. Faça login novamente.' },
      { status: 401 }
    );
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Tudo, exceto arquivos estáticos e internos do Next.js
  matcher: ['/((?!_next/static|_next/image|favicon|icon|logo|manifest|sw\\.js|.*\\.(?:png|jpg|jpeg|svg|ico|webp|json|js)$).*)'],
};
