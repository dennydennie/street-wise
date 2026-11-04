export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export const haversineMeters = (a: LatLng, b: LatLng): number => {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** A lat/lng box that contains every point within `radiusM` of `centre` (cheap index prefilter). */
export const boundingBox = (centre: LatLng, radiusM: number) => {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(0.01, Math.cos(rad(centre.lat))));
  return { minLat: centre.lat - dLat, maxLat: centre.lat + dLat, minLng: centre.lng - dLng, maxLng: centre.lng + dLng };
};

/** The closest candidate within `maxM`, or null. */
export const nearestWithin = <T extends LatLng>(target: LatLng, candidates: readonly T[], maxM: number): { item: T; distanceM: number } | null => {
  let best: { item: T; distanceM: number } | null = null;
  for (const item of candidates) {
    const distanceM = haversineMeters(target, item);
    if (distanceM <= maxM && (!best || distanceM < best.distanceM)) best = { item, distanceM };
  }
  return best;
};
