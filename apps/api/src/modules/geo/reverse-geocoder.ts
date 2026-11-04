import { Logger } from '@nestjs/common';
import type { LatLng } from './haversine';

export const REVERSE_GEOCODER = Symbol('REVERSE_GEOCODER');

export interface ReverseGeocoder {
  /** A short place name (street / intersection / neighbourhood), or null. Never throws. */
  nameFor(point: LatLng): Promise<string | null>;
}

/** GEOCODER=none */
export class NoReverseGeocoder implements ReverseGeocoder {
  async nameFor(): Promise<string | null> {
    return null;
  }
}

const TIMEOUT_MS = 2_000;
const MAX_NAME_LENGTH = 120;

type MapboxFeature = { properties?: { name?: string; feature_type?: string; context?: { place?: { name?: string } } } };

/** GEOCODER=mapbox: Mapbox Geocoding v6 reverse lookup with the server-side (secret) token. */
export class MapboxReverseGeocoder implements ReverseGeocoder {
  private readonly logger = new Logger('MapboxGeocoder');

  constructor(private readonly accessToken: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async nameFor(point: LatLng): Promise<string | null> {
    const url = new URL('https://api.mapbox.com/search/geocode/v6/reverse');
    url.searchParams.set('longitude', point.lng.toFixed(6));
    url.searchParams.set('latitude', point.lat.toFixed(6));
    url.searchParams.set('types', 'street,address,neighborhood,locality');
    url.searchParams.set('limit', '1');
    url.searchParams.set('access_token', this.accessToken);
    try {
      const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) {
        this.logger.warn(`Mapbox reverse geocode failed with HTTP ${response.status}`);
        return null;
      }
      const body = (await response.json()) as { features?: MapboxFeature[] };
      const name = body.features?.[0]?.properties?.name?.trim();
      return name ? name.slice(0, MAX_NAME_LENGTH) : null;
    } catch (error) {
      this.logger.warn(`Mapbox reverse geocode unavailable: ${(error as Error).message}`);
      return null;
    }
  }
}
