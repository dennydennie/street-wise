import { REPORT_LIFETIME_HOURS, type ReportType } from '@streetwise/shared';

/**
 * Deterministic 90-day demo history around Harare CBD so briefings have
 * something to say. Coordinates are approximate (good enough for a demo, not
 * for navigation).
 */
export const DEMO_REPORTER_PHONE = '+263770000001';

export const DEMO_AREAS = {
  sekeCripps: { id: 'de300000-0000-4000-8000-000000000001', name: 'Seke Rd × Cripps Rd', lat: -17.8447, lng: 31.0342 },
  rottenRow: { id: 'de300000-0000-4000-8000-000000000002', name: 'Rotten Row', lat: -17.8355, lng: 31.04 },
  mbareRd: { id: 'de300000-0000-4000-8000-000000000003', name: 'Mbare Rd', lat: -17.853, lng: 31.038 },
} as const;
/** The seeded camera area at Samora Machel × Julius Nyerere (camera 1). */
export const SAMORA_JULIUS = { id: 'a7ea0000-0000-4000-8000-000000000001', lat: -17.8268, lng: 31.0479 } as const;

export type DemoReport = {
  type: ReportType;
  lat: number;
  lng: number;
  areaId: string;
  locationName: string;
  capturedAt: Date;
  status: 'live' | 'gone';
  expiresAt: Date;
  stillThereCount: number;
  goneCount: number;
  summary: string;
  severity: number;
  tags: string[];
};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** mulberry32: tiny seeded PRNG so every run builds the same history. */
const prng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** `daysAgo` days before today (Africa/Harare, UTC+2) at local `hour:minute`. */
const harareTime = (now: Date, daysAgo: number, hour: number, minute: number): Date => {
  const local = new Date(now.getTime() + 2 * HOUR_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysAgo, hour - 2, minute));
};

export const buildDemoHistory = (now: Date): DemoReport[] => {
  const random = prng(263);
  const pick = <T>(values: readonly T[]) => values[Math.floor(random() * values.length)];
  const jitter = (point: { lat: number; lng: number }) => ({
    lat: point.lat + (random() - 0.5) * 0.0006,
    lng: point.lng + (random() - 0.5) * 0.0006,
  });
  const out: DemoReport[] = [];

  /** Historic reports are off the map: expired, or voted gone if still within their lifetime. */
  const historic = (
    type: ReportType,
    area: { id: string; name: string; lat: number; lng: number },
    capturedAt: Date,
    extra: Partial<DemoReport> & Pick<DemoReport, 'summary' | 'severity'>,
  ) => {
    const expiresAt = new Date(capturedAt.getTime() + REPORT_LIFETIME_HOURS[type] * HOUR_MS);
    const stillLive = expiresAt.getTime() > now.getTime();
    out.push({
      type,
      ...jitter(area),
      areaId: area.id,
      locationName: area.name,
      capturedAt,
      status: stillLive ? 'gone' : 'live',
      expiresAt,
      stillThereCount: 0,
      goneCount: stillLive ? 3 : 0,
      tags: [],
      ...extra,
    });
  };

  // Seke × Cripps: smash-and-grabs at the robot, concentrated 19:00–23:00. None live (all ≥ 8 days old).
  const seke = DEMO_AREAS.sekeCripps;
  const crimeHours = [19, 19, 20, 20, 20, 21, 21, 21, 22, 22, 22, 20, 10, 15];
  crimeHours.forEach((hour, i) => {
    const daysAgo = 8 + Math.floor((i * 80) / crimeHours.length) + Math.floor(random() * 4);
    historic('crime_hotspot', seke, harareTime(now, daysAgo, hour, Math.floor(random() * 60)), {
      summary: pick(['Smash and grab at the robot', 'Window smashed while waiting at the lights', 'Phone snatched through the window at the robot']),
      severity: 4,
      tags: hour >= 19 ? ['night', 'smash_and_grab'] : ['smash_and_grab'],
      stillThereCount: i % 3 === 0 ? 2 : 0,
    });
  });
  // …and its robot is out right now (plus two older outages).
  historic('robot_out', seke, harareTime(now, 21, 6, 40), { summary: 'Robot not working', severity: 3 });
  historic('robot_out', seke, harareTime(now, 47, 17, 15), { summary: 'Traffic lights off', severity: 3 });
  const robotNow = new Date(now.getTime() - 30 * 60_000);
  out.push({
    type: 'robot_out',
    ...jitter(seke),
    areaId: seke.id,
    locationName: seke.name,
    capturedAt: robotNow,
    status: 'live',
    expiresAt: new Date(robotNow.getTime() + REPORT_LIFETIME_HOURS.robot_out * HOUR_MS),
    stillThereCount: 1,
    goneCount: 0,
    summary: 'Robot not working at Seke and Cripps',
    severity: 3,
    tags: [],
  });

  // Samora Machel × Julius Nyerere: kombis loading mid-road in the rush hours.
  const samora = { ...SAMORA_JULIUS, name: 'Samora Machel × Julius Nyerere' };
  for (let i = 0; i < 22; i += 1) {
    const hour = pick([7, 7, 8, 8, 16, 17, 17]);
    historic('kombi_stop', samora, harareTime(now, 1 + Math.floor(random() * 88), hour, Math.floor(random() * 60)), {
      summary: pick(['Kombis stopping in the middle of the road', 'ZUPCO and kombis loading at the robot', 'Mushikashika blocking the left lane']),
      severity: 2,
      tags: ['rush_hour'],
    });
  }

  // Rotten Row: potholes at any hour; three are still live on the map.
  const rotten = DEMO_AREAS.rottenRow;
  for (let i = 0; i < 10; i += 1) {
    const capturedAt = harareTime(now, i < 3 ? 2 + i * 5 : 35 + i * 5, Math.floor(random() * 24), Math.floor(random() * 60));
    const expiresAt = new Date(capturedAt.getTime() + REPORT_LIFETIME_HOURS.pothole * HOUR_MS);
    out.push({
      type: 'pothole',
      ...jitter(rotten),
      areaId: rotten.id,
      locationName: rotten.name,
      capturedAt,
      status: 'live',
      expiresAt,
      stillThereCount: i < 3 ? 2 : 0,
      goneCount: 0,
      summary: pick(['Big pothole in the left lane', 'Deep pothole near the kerb', 'Potholes all along Rotten Row']),
      severity: i % 2 === 0 ? 3 : 2,
      tags: [],
    });
  }

  // Mbare Rd: flooding after afternoon storms.
  const mbare = DEMO_AREAS.mbareRd;
  [14, 15, 15, 16, 17, 18].forEach((hour, i) => {
    historic('flooding', mbare, harareTime(now, 10 + i * 12, hour, Math.floor(random() * 60)), {
      summary: 'Water over the road after the storm',
      severity: 3,
      tags: [],
    });
  });

  return out.filter((report) => report.capturedAt.getTime() < now.getTime() - 5 * 60_000 || report.status === 'live')
    .filter((report) => report.capturedAt.getTime() > now.getTime() - 89 * DAY_MS);
};
