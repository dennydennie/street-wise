import { OTP_MAX_VERIFY_ATTEMPTS, OTP_TTL_SECONDS } from '@streetwise/shared';
import { checkOtpCode, generateOtpCode, hashOtpCode, otpRetryAfterSeconds, OtpChallengeState } from './otp-code';

const pepper = 'local-test-otp-pepper';
const phone = '+263771234567';
const issuedAt = new Date('2026-11-04T08:00:00Z');

const challenge = (overrides: Partial<OtpChallengeState> = {}): OtpChallengeState => ({
  phone,
  codeHash: hashOtpCode(phone, '123456', pepper),
  expiresAt: new Date(issuedAt.getTime() + OTP_TTL_SECONDS * 1000),
  attempts: 0,
  consumedAt: null,
  ...overrides,
});

describe('OTP codes', () => {
  it('generates six digits', () => {
    for (let i = 0; i < 50; i += 1) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it('stores a hash, not the code, and binds it to the phone', () => {
    const hash = hashOtpCode(phone, '123456', pepper);
    expect(hash).not.toContain('123456');
    expect(hash).not.toBe(hashOtpCode('+263781234567', '123456', pepper));
  });

  it('accepts the right code before expiry', () => {
    expect(checkOtpCode(challenge(), '123456', pepper, new Date(issuedAt.getTime() + 60_000))).toBe('ok');
  });

  it('rejects a wrong code', () => {
    expect(checkOtpCode(challenge(), '654321', pepper, issuedAt)).toBe('invalid');
  });

  it('expires after five minutes even with the right code', () => {
    const atExpiry = new Date(issuedAt.getTime() + 5 * 60_000);
    expect(checkOtpCode(challenge(), '123456', pepper, atExpiry)).toBe('expired');
  });

  it('locks after too many attempts', () => {
    expect(checkOtpCode(challenge({ attempts: OTP_MAX_VERIFY_ATTEMPTS }), '123456', pepper, issuedAt)).toBe('too_many_attempts');
  });

  it('cannot be reused', () => {
    expect(checkOtpCode(challenge({ consumedAt: issuedAt }), '123456', pepper, issuedAt)).toBe('consumed');
  });
});

describe('OTP send rate limit', () => {
  const limits = { maxPerWindow: 3, windowSeconds: 900, cooldownSeconds: 60 };
  const at = (secondsAgo: number) => ({ createdAt: new Date(issuedAt.getTime() - secondsAgo * 1000) });

  it('allows the first code', () => {
    expect(otpRetryAfterSeconds([], issuedAt, limits)).toBe(0);
  });

  it('enforces the resend cooldown', () => {
    expect(otpRetryAfterSeconds([at(20)], issuedAt, limits)).toBe(40);
  });

  it('enforces the per-window cap', () => {
    expect(otpRetryAfterSeconds([at(600), at(300), at(100)], issuedAt, limits)).toBe(300);
  });
});
