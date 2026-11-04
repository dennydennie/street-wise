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
  get gikko() { return this.get('gikko'); }
  get emailProvider() { return this.get('emailProvider'); }
  get sendgrid() { return this.get('sendgrid'); }
  get emailSender() { return this.get('emailSender'); }
  get supportEmail() { return this.get('supportEmail'); }
  get moderationEmail() { return this.get('moderationEmail'); }
  get databaseUrl() { return this.get('databaseUrl'); }
  get databaseSsl() { return this.get('databaseSsl'); }
  get databaseLogQueries() { return this.get('databaseLogQueries'); }
  get redisUrl() { return this.get('redisUrl'); }
  get paynowMode() { return this.get('paynowMode'); }
  get paynowIntegrationId() { return this.get('paynowIntegrationId'); }
  get paynowIntegrationKey() { return this.get('paynowIntegrationKey'); }
  get paynowAuthEmail() { return this.get('paynowAuthEmail'); }
  get paynowReturnUrl() { return this.get('paynowReturnUrl'); }
  get fakePaynowAutoSettleSeconds() { return this.get('fakePaynowAutoSettleSeconds'); }
  get otpDevEcho() { return this.get('otpDevEcho') && !this.isProduction; }
  get corsOrigins() { return this.get('corsOrigins'); }
  get webauthnRpId() { return this.get('webauthnRpId'); }
  get webauthnRpName() { return this.get('webauthnRpName'); }
  get webauthnOrigins() { return this.get('webauthnOrigins'); }
  get androidPackageName() { return this.get('androidPackageName'); }
  get androidSha256CertFingerprints() { return this.get('androidSha256CertFingerprints'); }
  get mapboxPublicToken() { return this.get('mapboxPublicToken'); }
  get mapboxStyle() { return this.get('mapboxStyle'); }
  get mapboxSecretToken() { return this.get('mapboxSecretToken'); }
  get geocoder() { return this.get('geocoder'); }
  get reportAnalyzer() { return this.get('reportAnalyzer'); }
  get briefingWriter() { return this.get('briefingWriter'); }
  get anthropicApiKey() { return this.get('anthropicApiKey'); }
  get anthropicModel() { return this.get('anthropicModel'); }
  get transcriptionProvider() { return this.get('transcriptionProvider'); }
  get openaiApiKey() { return this.get('openaiApiKey'); }
  get openaiTranscribeModel() { return this.get('openaiTranscribeModel'); }
  get paynowResultUrl() { return `${this.get('apiPublicBaseUrl')}/payments/paynow/result`; }
}
