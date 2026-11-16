// lib/masterSession.ts
// Sessão do DDS Master: token assinado com HMAC-SHA256 num cookie HttpOnly.
// Usa Web Crypto, então funciona tanto no middleware (Edge) quanto nas rotas (Node).
//
// Antes, o "login" só gravava a sessão no navegador e nenhuma rota da API conferia
// nada: qualquer pessoa com o endereço do Master conseguia ler e alterar tudo.

export const MASTER_SESSION_COOKIE = 'dds_master_session';
export const MASTER_SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 horas

export interface MasterSessionPayload {
  sub: string;   // e-mail do administrador mestre
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecodeToString(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return atob(padded);
}

/** Segredo de assinatura: obrigatório e com pelo menos 32 caracteres (sem valor padrão). */
export function getMasterSessionSecret(): string | null {
  const secret = (process.env.MASTER_SESSION_SECRET || '').trim();
  return secret.length >= 32 ? secret : null;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createMasterSessionToken(email: string): Promise<string | null> {
  const secret = getMasterSessionSecret();
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: MasterSessionPayload = { sub: email, iat: now, exp: now + MASTER_SESSION_TTL_SECONDS };
  const encoded = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await hmac(secret, encoded)}`;
}

export async function verifyMasterSessionToken(token: string | undefined | null): Promise<MasterSessionPayload | null> {
  const secret = getMasterSessionSecret();
  if (!secret || !token || typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = await hmac(secret, encoded);
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(base64UrlDecodeToString(encoded)) as MasterSessionPayload;
    // A sessão também deixa de valer se o e-mail mestre for trocado nas variáveis.
    const masterEmail = (process.env.MASTER_EMAIL || '').toLowerCase().trim();
    if (!payload?.sub || payload.sub !== masterEmail) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function masterSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${MASTER_SESSION_COOKIE}=${token}; Path=/; Max-Age=${MASTER_SESSION_TTL_SECONDS}; HttpOnly; SameSite=Strict${secure}`;
}

export function clearMasterSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${MASTER_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`;
}
