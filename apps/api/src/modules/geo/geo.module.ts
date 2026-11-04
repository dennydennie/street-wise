import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { MapboxReverseGeocoder, NoReverseGeocoder, REVERSE_GEOCODER, ReverseGeocoder } from './reverse-geocoder';

@Global()
@Module({
  providers: [
    {
      provide: REVERSE_GEOCODER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): ReverseGeocoder =>
        config.geocoder === 'mapbox' && config.mapboxSecretToken
          ? new MapboxReverseGeocoder(config.mapboxSecretToken)
          : new NoReverseGeocoder(),
    },
  ],
  exports: [REVERSE_GEOCODER],
})
export class GeoModule {}
