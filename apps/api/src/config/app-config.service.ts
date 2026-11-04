import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiEnv } from './env.schema';

/** Typed view over the validated environment (see `env.schema.ts`). */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  private get<K extends keyof ApiEnv>(key: K): ApiEnv[K] {
    return this.config.get(key, { infer: true });
  }

  get appName() { return this.get('appName'); }
  get nodeEnv() { return this.get('nodeEnv'); }
  get isProduction() { return this.get('nodeEnv') === 'production'; }
  get apiPort() { return this.get('apiPort'); }
  get apiPublicBaseUrl() { return this.get('apiPublicBaseUrl'); }
  get trustProxyHops() { return this.get('trustProxyHops'); }
  get swaggerUiEnabled() { return this.get('swaggerUiEnabled'); }
  get apiJwtSecret() { return this.get('apiJwtSecret'); }
  get otpPepper() { return this.get('otpPepper'); }
  get smsProvider() { return this.get('smsProvider'); }
  get databaseUrl() { return this.get('databaseUrl'); }
  get databaseSsl() { return this.get('databaseSsl'); }
  get databaseLogQueries() { return this.get('databaseLogQueries'); }
  get redisUrl() { return this.get('redisUrl'); }
  get paynowMode() { return this.get('paynowMode'); }
  get paynowIntegrationId() { return this.get('paynowIntegrationId'); }
  get paynowIntegrationKey() { return this.get('paynowIntegrationKey'); }
  get paynowAuthEmail() { return this.get('paynowAuthEmail'); }
  get paynowReturnUrl() { return this.get('paynowReturnUrl'); }
  get paynowResultUrl() { return `${this.get('apiPublicBaseUrl')}/payments/paynow/result`; }
}
