import { parseEnv } from './env.schema';

const base = {
  NODE_ENV: 'development',
  API_JWT_SECRET: 'local-test-secret-with-enough-length-0000',
  OTP_PEPPER: 'local-test-otp-pepper',
  DATABASE_URL: 'postgresql://streetwise:streetwise@localhost:5436/streetwise',
};

describe('parseEnv', () => {
  it('accepts the local defaults with the fake Paynow gateway', () => {
    const env = parseEnv(base);
    expect(env.paynowMode).toBe('fake');
    expect(env.apiPort).toBe(4100);
  });

  it('requires Paynow credentials outside fake mode', () => {
    expect(() => parseEnv({ ...base, PAYNOW_MODE: 'live' })).toThrow(/PAYNOW_INTEGRATION_ID/);
  });

  it('refuses the console SMS sender and fake payments in production', () => {
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', API_JWT_SECRET: 'x'.repeat(40) }),
    ).toThrow(/PAYNOW_MODE=live[\s\S]*SMS_PROVIDER=console/);
  });
});
