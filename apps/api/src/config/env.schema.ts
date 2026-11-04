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
};

/** Hash key used by the fake Paynow gateway; never accepted outside fake mode. */
export const FAKE_PAYNOW_INTEGRATION_KEY = 'fake-paynow-integration-key-local-only';

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
});

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
  if (raw.NODE_ENV === 'production') {
    if (raw.PAYNOW_MODE !== 'live') issues.push('production requires PAYNOW_MODE=live');
    if (raw.SMS_PROVIDER === 'console') issues.push('production cannot use SMS_PROVIDER=console (it logs sign-in codes)');
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
  };
};

const emptyToUndefined = (input: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value === '' ? undefined : value]));
