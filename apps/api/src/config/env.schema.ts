import { z } from 'zod';

export type ApiEnv = {
  appName: string;
  nodeEnv: 'development' | 'test' | 'staging' | 'production';
  apiPort: number;
  /** Public origin + prefix the API is reached at; Paynow's result URL is built from it. */
  apiPublicBaseUrl: string;
  trustProxyHops: number;
  swaggerUiEnabled: boolean;
  apiJwtSecret: string;
  /** Mixed into every OTP hash so a leaked table cannot be brute-forced offline. */
  otpPepper: string;
  smsProvider: 'console';
  databaseUrl: string;
  databaseSsl: boolean;
  databaseLogQueries: boolean;
  /** Reserved for rate limiting / queues; nothing reads Redis yet. */
  redisUrl?: string;
  paynowMode: 'fake' | 'sandbox' | 'live';
  paynowIntegrationId?: string;
  paynowIntegrationKey: string;
  /** Paynow test mode only completes mobile payments for the merchant's own e-mail. */
  paynowAuthEmail?: string;
  /** Where Paynow sends the payer back after the web checkout (app deep link or web page). */
  paynowReturnUrl: string;
  /** Fake mode only: settle an EcoCash payment by itself after this many seconds (0 = off). */
  fakePaynowAutoSettleSeconds: number;
  /** Non-production only: `POST /auth/otp/request` returns the code as `devCode`. */
  otpDevEcho: boolean;
  /** Extra browser origins allowed by CORS (any http://localhost:<port> is added outside production). */
  corsOrigins: string[];
  webauthnRpId: string;
  webauthnRpName: string;
  /** Exact origins, `android:apk-key-hash:…`, or `http://localhost:*` (port wildcard, non-production only). */
  webauthnOrigins: string[];
  androidPackageName?: string;
  /** `AA:BB:…` SHA-256 signing-certificate fingerprints, upper case. */
  androidSha256CertFingerprints: string[];
  mapboxPublicToken?: string;
  mapboxStyle: string;
  mapboxSecretToken?: string;
  geocoder: 'none' | 'mapbox';
  reportAnalyzer: 'rules' | 'claude';
  briefingWriter: 'template' | 'claude';
  anthropicApiKey?: string;
  anthropicModel: string;
  transcriptionProvider: 'none' | 'openai';
  openaiApiKey?: string;
  openaiTranscribeModel: string;
};

/** Hash key used by the fake Paynow gateway; never accepted outside fake mode. */
export const FAKE_PAYNOW_INTEGRATION_KEY = 'fake-paynow-integration-key-local-only';

/** The only wildcard allowed: any port on the loopback host, outside production. */
const LOCALHOST_WILDCARD = /^http:\/\/(localhost|127\.0\.0\.1):\*$/;

const booleanFlag = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('StreetWise ZW'),
  API_PORT: z.coerce.number().int().positive().default(4100),
  API_PUBLIC_BASE_URL: z.string().url().default('http://localhost:4100'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  SWAGGER_UI_ENABLED: booleanFlag,
  API_JWT_SECRET: z.string().min(32, 'API_JWT_SECRET must be at least 32 characters'),
  OTP_PEPPER: z.string().min(16, 'OTP_PEPPER must be at least 16 characters'),
  SMS_PROVIDER: z.enum(['console']).default('console'),
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: booleanFlag,
  DATABASE_LOG_QUERIES: booleanFlag,
  REDIS_URL: z.string().url().optional(),
  PAYNOW_MODE: z.enum(['fake', 'sandbox', 'live']).default('fake'),
  PAYNOW_INTEGRATION_ID: z.string().min(1).optional(),
  PAYNOW_INTEGRATION_KEY: z.string().min(1).optional(),
  PAYNOW_AUTH_EMAIL: z.string().email().optional(),
  PAYNOW_RETURN_URL: z.string().url().default('streetwise://payments/return'),
  FAKE_PAYNOW_AUTO_SETTLE_SECONDS: z.coerce.number().int().min(0).max(600).optional(),
  OTP_DEV_ECHO: booleanFlag,
  CORS_ORIGINS: z.string().optional(),
  WEBAUTHN_RP_ID: z.string().min(1).default('localhost'),
  WEBAUTHN_RP_NAME: z.string().min(1).optional(),
  WEBAUTHN_ORIGINS: z.string().optional(),
  ANDROID_PACKAGE_NAME: z.string().regex(/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/, 'ANDROID_PACKAGE_NAME must look like zw.co.streetwise.app').optional(),
  ANDROID_SHA256_CERT_FINGERPRINTS: z.string().optional(),
  MAPBOX_PUBLIC_TOKEN: z.string().min(1).optional(),
  MAPBOX_STYLE: z.string().regex(/^[\w-]+\/[\w-]+$/, 'MAPBOX_STYLE must be <owner>/<style-id>').default('mapbox/streets-v12'),
  MAPBOX_SECRET_TOKEN: z.string().min(1).optional(),
  GEOCODER: z.enum(['none', 'mapbox']).default('none'),
  REPORT_ANALYZER: z.enum(['rules', 'claude']).default('rules'),
  BRIEFING_WRITER: z.enum(['template', 'claude']).default('template'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-haiku-5-5'),
  TRANSCRIPTION_PROVIDER: z.enum(['none', 'openai']).default('none'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_TRANSCRIBE_MODEL: z.string().min(1).default('gpt-4o-mini-transcribe'),
});

const FINGERPRINT_PATTERN = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** Splits a comma list, trimming blanks and trailing slashes on URLs. */
export const parseList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter((entry) => entry.length > 0);

export const parseEnv = (input: Record<string, unknown>): ApiEnv => {
  const raw = rawSchema.parse(emptyToUndefined(input));
  const issues: string[] = [];
  const deployed = raw.NODE_ENV === 'staging' || raw.NODE_ENV === 'production';

  if (raw.PAYNOW_MODE !== 'fake' && (!raw.PAYNOW_INTEGRATION_ID || !raw.PAYNOW_INTEGRATION_KEY)) {
    issues.push(`PAYNOW_MODE=${raw.PAYNOW_MODE} needs PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY`);
  }
  if (raw.PAYNOW_MODE === 'sandbox' && !raw.PAYNOW_AUTH_EMAIL) {
    issues.push('PAYNOW_MODE=sandbox needs PAYNOW_AUTH_EMAIL (Paynow test mode only accepts the merchant e-mail)');
  }
  const corsOrigins = parseList(raw.CORS_ORIGINS);
  const webauthnOrigins = parseList(raw.WEBAUTHN_ORIGINS ?? (raw.NODE_ENV === 'production' ? '' : 'http://localhost:*'));
  const fingerprints = parseList(raw.ANDROID_SHA256_CERT_FINGERPRINTS).map((value) => value.toUpperCase());
  const fakeAutoSettle = raw.FAKE_PAYNOW_AUTO_SETTLE_SECONDS ?? 0;

  for (const fingerprint of fingerprints) {
    if (!FINGERPRINT_PATTERN.test(fingerprint)) issues.push(`ANDROID_SHA256_CERT_FINGERPRINTS entry is not AA:BB:… SHA-256: ${fingerprint}`);
  }
  if (fakeAutoSettle > 0 && raw.PAYNOW_MODE !== 'fake') {
    issues.push('FAKE_PAYNOW_AUTO_SETTLE_SECONDS only works with PAYNOW_MODE=fake');
  }
  if (raw.MAPBOX_PUBLIC_TOKEN && !raw.MAPBOX_PUBLIC_TOKEN.startsWith('pk.')) {
    issues.push('MAPBOX_PUBLIC_TOKEN must be a public pk.* token (it is sent to every client)');
  }
  if (raw.GEOCODER === 'mapbox' && !raw.MAPBOX_SECRET_TOKEN) issues.push('GEOCODER=mapbox needs MAPBOX_SECRET_TOKEN');
  if ((raw.REPORT_ANALYZER === 'claude' || raw.BRIEFING_WRITER === 'claude') && !raw.ANTHROPIC_API_KEY) {
    issues.push('REPORT_ANALYZER=claude / BRIEFING_WRITER=claude need ANTHROPIC_API_KEY');
  }
  if (raw.TRANSCRIPTION_PROVIDER === 'openai' && !raw.OPENAI_API_KEY) issues.push('TRANSCRIPTION_PROVIDER=openai needs OPENAI_API_KEY');
  if (raw.ANDROID_PACKAGE_NAME && fingerprints.length === 0) {
    issues.push('ANDROID_PACKAGE_NAME needs ANDROID_SHA256_CERT_FINGERPRINTS');
  }

  if (raw.NODE_ENV === 'production') {
    if (raw.PAYNOW_MODE !== 'live') issues.push('production requires PAYNOW_MODE=live');
    if (raw.SMS_PROVIDER === 'console') issues.push('production cannot use SMS_PROVIDER=console (it logs sign-in codes)');
    if (raw.OTP_DEV_ECHO) issues.push('production cannot use OTP_DEV_ECHO (it returns sign-in codes over the API)');
    if (fakeAutoSettle > 0) issues.push('production cannot use FAKE_PAYNOW_AUTO_SETTLE_SECONDS');
    if (raw.WEBAUTHN_RP_ID === 'localhost') issues.push('production needs a real WEBAUTHN_RP_ID (e.g. streetwise.co.zw)');
    if (webauthnOrigins.length === 0) issues.push('production needs WEBAUTHN_ORIGINS');
    for (const origin of [...webauthnOrigins, ...corsOrigins]) {
      if (origin.includes('*')) issues.push(`production cannot use wildcard origins: ${origin}`);
      else if (!origin.startsWith('https://') && !origin.startsWith('android:apk-key-hash:')) {
        issues.push(`production origins must be https:// (or android:apk-key-hash:…): ${origin}`);
      }
    }
  } else {
    for (const origin of [...webauthnOrigins, ...corsOrigins]) {
      if (origin.includes('*') && !LOCALHOST_WILDCARD.test(origin)) {
        issues.push(`only http://localhost:* / http://127.0.0.1:* may use a wildcard: ${origin}`);
      }
    }
  }
  if (deployed && /local|test/i.test(raw.API_JWT_SECRET)) {
    issues.push('API_JWT_SECRET looks like a local value; generate a real secret');
  }
  if (raw.DATABASE_LOG_QUERIES && raw.NODE_ENV !== 'development') {
    issues.push('DATABASE_LOG_QUERIES is only allowed when NODE_ENV=development');
  }

  if (issues.length > 0) {
    throw new Error(`Invalid environment:\n- ${issues.join('\n- ')}`);
  }

  return {
    appName: raw.APP_NAME,
    nodeEnv: raw.NODE_ENV,
    apiPort: raw.API_PORT,
    apiPublicBaseUrl: raw.API_PUBLIC_BASE_URL.replace(/\/+$/, ''),
    trustProxyHops: raw.TRUST_PROXY_HOPS,
    swaggerUiEnabled: raw.SWAGGER_UI_ENABLED ?? false,
    apiJwtSecret: raw.API_JWT_SECRET,
    otpPepper: raw.OTP_PEPPER,
    smsProvider: raw.SMS_PROVIDER,
    databaseUrl: raw.DATABASE_URL,
    databaseSsl: raw.DATABASE_SSL ?? false,
    databaseLogQueries: raw.DATABASE_LOG_QUERIES ?? false,
    redisUrl: raw.REDIS_URL,
    paynowMode: raw.PAYNOW_MODE,
    paynowIntegrationId: raw.PAYNOW_INTEGRATION_ID,
    paynowIntegrationKey: raw.PAYNOW_MODE === 'fake' ? FAKE_PAYNOW_INTEGRATION_KEY : (raw.PAYNOW_INTEGRATION_KEY as string),
    paynowAuthEmail: raw.PAYNOW_AUTH_EMAIL,
    paynowReturnUrl: raw.PAYNOW_RETURN_URL,
    fakePaynowAutoSettleSeconds: fakeAutoSettle,
    otpDevEcho: raw.OTP_DEV_ECHO ?? false,
    corsOrigins,
    webauthnRpId: raw.WEBAUTHN_RP_ID,
    webauthnRpName: raw.WEBAUTHN_RP_NAME ?? raw.APP_NAME,
    webauthnOrigins,
    androidPackageName: raw.ANDROID_PACKAGE_NAME,
    androidSha256CertFingerprints: fingerprints,
    mapboxPublicToken: raw.MAPBOX_PUBLIC_TOKEN,
    mapboxStyle: raw.MAPBOX_STYLE,
    mapboxSecretToken: raw.MAPBOX_SECRET_TOKEN,
    geocoder: raw.GEOCODER,
    reportAnalyzer: raw.REPORT_ANALYZER,
    briefingWriter: raw.BRIEFING_WRITER,
    anthropicApiKey: raw.ANTHROPIC_API_KEY,
    anthropicModel: raw.ANTHROPIC_MODEL,
    transcriptionProvider: raw.TRANSCRIPTION_PROVIDER,
    openaiApiKey: raw.OPENAI_API_KEY,
    openaiTranscribeModel: raw.OPENAI_TRANSCRIBE_MODEL,
  };
};

const emptyToUndefined = (input: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value === '' ? undefined : value]));
