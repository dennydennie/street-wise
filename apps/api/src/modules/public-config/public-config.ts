import { HARARE_CENTRE, type PublicConfig } from '@streetwise/shared';

export type PublicConfigInput = {
  mapboxPublicToken?: string;
  mapboxStyle: string;
  transcriptionProvider: 'none' | 'openai';
  reportAnalyzer: 'rules' | 'claude';
  passkeysEnabled: boolean;
};

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** What any client may know: Mapbox only with a public pk.* token, OSM otherwise. */
export const buildPublicConfig = (input: PublicConfigInput): PublicConfig => ({
  map: input.mapboxPublicToken
    ? {
        provider: 'mapbox',
        tileUrlTemplate: `https://api.mapbox.com/styles/v1/${input.mapboxStyle}/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(input.mapboxPublicToken)}`,
        attribution: '© Mapbox © OpenStreetMap contributors',
        maxZoom: 20,
      }
    : { provider: 'osm', tileUrlTemplate: OSM_TILES, attribution: '© OpenStreetMap contributors', maxZoom: 19 },
  features: {
    serverTranscription: input.transcriptionProvider !== 'none',
    passkeys: input.passkeysEnabled,
    llmAnalysis: input.reportAnalyzer === 'claude',
  },
  harare: { lat: HARARE_CENTRE.lat, lng: HARARE_CENTRE.lng },
});

/** Digital Asset Links statement for the Android app (passkeys via Credential Manager + app links). */
export const buildAssetLinks = (packageName: string, fingerprints: string[]) => [
  {
    relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
    target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints },
  },
];
