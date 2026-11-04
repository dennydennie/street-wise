import { createHmac, timingSafeEqual } from 'node:crypto';

/** Who a verified access token belongs to. */
export type AuthenticatedUser = { userId: string; sessionId: string };

type TokenPayload = { sub: string; sid: string; iat: number; exp: number; typ: 'access' };

export const ACCESS_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const base64url = (input: string | Buffer): string => Buffer.from(input).toString('base64url');
const sign = (data: string, secret: string): string => createHmac('sha256', secret).update(data).digest('base64url');
const HEADER = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

/** HS256 JWT. Revocation is enforced through the session row, not the token. */
export const signAccessToken = (
  user: AuthenticatedUser,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string => {
  const payload: TokenPayload = {
    sub: user.userId,
    sid: user.sessionId,
    iat: nowSeconds,
    exp: nowSeconds + ACCESS_TOKEN_TTL_SECONDS,
    typ: 'access',
  };
  const body = `${HEADER}.${base64url(JSON.stringify(payload))}`;
  return `${body}.${sign(body, secret)}`;
};

/** Returns the token's subject, or null when the token is malformed, forged or expired. */
export const verifyAccessToken = (
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): AuthenticatedUser | null => {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== HEADER) return null;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let payload: Partial<TokenPayload>;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
  return { userId: payload.sub, sessionId: payload.sid };
};
