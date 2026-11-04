import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from '../../config/app-config.service';
import { Public } from '../auth/public.decorator';
import { buildAssetLinks, buildPublicConfig } from './public-config';

@ApiTags('config')
@Controller()
export class PublicConfigController {
  constructor(private readonly config: AppConfigService) {}

  @Public()
  @Get('config/public')
  @Header('Cache-Control', 'public, max-age=300')
  publicConfig() {
    return buildPublicConfig({
      mapboxPublicToken: this.config.mapboxPublicToken,
      mapboxStyle: this.config.mapboxStyle,
      transcriptionProvider: this.config.transcriptionProvider,
      reportAnalyzer: this.config.reportAnalyzer,
      passkeysEnabled: this.config.webauthnOrigins.length > 0 || this.config.androidSha256CertFingerprints.length > 0,
    });
  }

  /** Must be served at https://<WEBAUTHN_RP_ID>/.well-known/assetlinks.json. 404 until the Android app is configured. */
  @ApiExcludeEndpoint()
  @Public()
  @Get('.well-known/assetlinks.json')
  @Header('Cache-Control', 'public, max-age=3600')
  assetLinks() {
    const packageName = this.config.androidPackageName;
    const fingerprints = this.config.androidSha256CertFingerprints;
    if (!packageName || fingerprints.length === 0) throw new NotFoundException();
    return buildAssetLinks(packageName, fingerprints);
  }
}
