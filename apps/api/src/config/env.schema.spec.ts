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

describe('parseEnv dev conveniences and new providers', () => {
  const production = {
    ...base,
    NODE_ENV: 'production',
    API_JWT_SECRET: 'x'.repeat(40),
    PAYNOW_MODE: 'live',
    PAYNOW_INTEGRATION_ID: '1',
    PAYNOW_INTEGRATION_KEY: 'k',
    WEBAUTHN_RP_ID: 'streetwise.co.zw',
    WEBAUTHN_ORIGINS: 'https://streetwise.co.zw',
  };

  it('accepts dev echo, auto-settle and the localhost wildcard locally', () => {
    const env = parseEnv({ ...base, OTP_DEV_ECHO: 'true', FAKE_PAYNOW_AUTO_SETTLE_SECONDS: '6', CORS_ORIGINS: 'http://localhost:*' });
    expect(env.otpDevEcho).toBe(true);
    expect(env.fakePaynowAutoSettleSeconds).toBe(6);
    expect(env.webauthnOrigins).toEqual(['http://localhost:*']);
    expect(env.reportAnalyzer).toBe('rules');
    expect(env.anthropicModel).toBe('claude-haiku-5-5');
  });

  it('refuses OTP_DEV_ECHO in production', () => {
    expect(() => parseEnv({ ...production, OTP_DEV_ECHO: 'true' })).toThrow(/OTP_DEV_ECHO/);
  });

  it('refuses fake Paynow auto-settle in production', () => {
    expect(() => parseEnv({ ...production, FAKE_PAYNOW_AUTO_SETTLE_SECONDS: '6' })).toThrow(/FAKE_PAYNOW_AUTO_SETTLE_SECONDS/);
  });

  it('refuses wildcard and localhost WebAuthn settings in production', () => {
    expect(() => parseEnv({ ...production, WEBAUTHN_ORIGINS: 'http://localhost:*' })).toThrow(/wildcard/);
    expect(() => parseEnv({ ...production, WEBAUTHN_RP_ID: 'localhost' })).toThrow(/WEBAUTHN_RP_ID/);
  });

  it('needs keys for the Claude analyzer, OpenAI transcription and the Mapbox geocoder', () => {
    expect(() => parseEnv({ ...base, REPORT_ANALYZER: 'claude' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => parseEnv({ ...base, TRANSCRIPTION_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
    expect(() => parseEnv({ ...base, GEOCODER: 'mapbox' })).toThrow(/MAPBOX_SECRET_TOKEN/);
    expect(() => parseEnv({ ...base, MAPBOX_PUBLIC_TOKEN: 'sk.secret' })).toThrow(/pk\./);
  });
});

describe('parseEnv SMS (Gikko) and e-mail (SendGrid)', () => {
  it('defaults to console senders locally with the support inbox set', () => {
    const env = parseEnv(base);
    expect(env.smsProvider).toBe('console');
    expect(env.emailProvider).toBe('console');
    expect(env.supportEmail).toBe('support@streetwise.co.zw');
    expect(env.gikko.baseUrl).toBe('https://api.infobip.com');
    expect(env.gikko.authScheme).toBe('App');
  });

  it('needs the Gikko key and SendGrid key + verified sender when selected', () => {
    expect(() => parseEnv({ ...base, SMS_PROVIDER: 'gikko' })).toThrow(/GIKKO_API_KEY/);
    expect(() => parseEnv({ ...base, EMAIL_PROVIDER: 'sendgrid' })).toThrow(/SENDGRID_API_KEY[\s\S]*EMAIL_SENDER_EMAIL/);
    const env = parseEnv({
      ...base,
      SMS_PROVIDER: 'gikko',
      GIKKO_API_KEY: 'k',
      GIKKO_SENDER_NAME: 'StreetWise',
      EMAIL_PROVIDER: 'sendgrid',
      SENDGRID_API_KEY: 'SG.k',
      EMAIL_SENDER_EMAIL: 'no-reply@streetwise.co.zw',
    });
    expect(env.gikko.apiKey).toBe('k');
    expect(env.emailSender).toEqual({ email: 'no-reply@streetwise.co.zw', name: 'StreetWise ZW' });
  });

  it('rejects sender IDs longer than 11 characters', () => {
    expect(() => parseEnv({ ...base, GIKKO_SENDER_NAME: 'StreetWiseZimbabwe' })).toThrow(/at most 11/);
  });

  it('refuses console e-mail in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', API_JWT_SECRET: 'x'.repeat(40) })).toThrow(/EMAIL_PROVIDER=console/);
  });
});
