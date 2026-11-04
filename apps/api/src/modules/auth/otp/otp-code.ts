import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP_LENGTH, OTP_MAX_VERIFY_ATTEMPTS } from '@streetwise/shared';

export const generateOtpCode = (): string => String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

/** HMAC-SHA256 of phone and code with the server pepper; the code itself is never stored. */
export const hashOtpCode = (phone: string, code: string, pepper: string): string =>
  createHmac('sha256', pepper).update(`${phone}:${code}`).digest('hex');

export type OtpChallengeState = {
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
};

export type OtpCheckResult = 'ok' | 'invalid' | 'expired' | 'too_many_attempts' | 'consumed';

/**
 * Decides one verification attempt. The caller must count the attempt
 * (`attempts + 1`) whenever the result is `invalid`.
 */
export const checkOtpCode = (challenge: OtpChallengeState, code: string, pepper: string, now: Date): OtpCheckResult => {
  if (challenge.consumedAt) return 'consumed';
  if (challenge.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (challenge.attempts >= OTP_MAX_VERIFY_ATTEMPTS) return 'too_many_attempts';

  const expected = Buffer.from(challenge.codeHash, 'hex');
  const actual = Buffer.from(hashOtpCode(challenge.phone, code, pepper), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? 'ok' : 'invalid';
};

export type OtpRequestHistory = { createdAt: Date }[];

/** Per-phone send budget. Returns seconds to wait, or 0 when a new code may be sent. */
export const otpRetryAfterSeconds = (
  recent: OtpRequestHistory,
  now: Date,
  limits: { maxPerWindow: number; windowSeconds: number; cooldownSeconds: number },
): number => {
  const nowMs = now.getTime();
  const inWindow = recent
    .map((entry) => entry.createdAt.getTime())
    .filter((at) => at > nowMs - limits.windowSeconds * 1000)
    .sort((a, b) => a - b);

  const latest = inWindow[inWindow.length - 1];
  const cooldownWait = latest === undefined ? 0 : latest + limits.cooldownSeconds * 1000 - nowMs;
  const windowWait =
    inWindow.length >= limits.maxPerWindow
      ? inWindow[inWindow.length - limits.maxPerWindow] + limits.windowSeconds * 1000 - nowMs
      : 0;
  return Math.max(0, Math.ceil(Math.max(cooldownWait, windowWait) / 1000));
};
