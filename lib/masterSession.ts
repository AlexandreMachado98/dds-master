// Sessão do DDS Master: token assinado com HMAC-SHA256 guardado em cookie HttpOnly.
// Usa apenas Web Crypto, então funciona tanto no middleware (Edge) quanto nas rotas (Node).

export const MASTER_SESSION_COOKIE = 'dds_master_auth';
export const MASTER_SESSION_TTL_SECONDS = 24 * 60 * 60;

interface MasterSessionPayload {
  sub: string;
  exp: number; // epoch em segundos
}

function getSecret(): string {
  // MASTER_SESSION_SECRET é o recomendado; MASTER_PASSWORD é o fallback para não exigir
  // uma variável nova (trocar a senha invalida todas as sessões abertas).
  return (process.env.MASTER_SESSION_SECRET || process.env.MASTER_PASSWORD || '').trim();
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string, secret: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function createMasterSessionToken(subject: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error('Segredo de sessão mestre não configurado.');

  const payload: MasterSessionPayload = {
    sub: subject,
    exp: Math.floor(Date.now() / 1000) + MASTER_SESSION_TTL_SECONDS,
  };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = base64UrlEncode(await hmac(body, secret));
  return `${body}.${sig}`;
}

export async function verifyMasterSessionToken(
  token: string | undefined | null
): Promise<MasterSessionPayload | null> {
  try {
    const secret = getSecret();
    if (!secret || !token) return null;

    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const expected = await hmac(body, secret);
    if (!timingSafeEqual(expected, base64UrlDecode(sig))) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as MasterSessionPayload;
    if (!payload?.sub || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
