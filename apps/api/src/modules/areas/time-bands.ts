import { BRIEFING_TIME_ZONE, TIME_BAND_HOURS, TIME_BANDS, type TimeBand } from '@streetwise/shared';

const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: BRIEFING_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });

/** Local hour (0–23) in Africa/Harare (UTC+2 all year, but resolved through the tz database anyway). */
export const harareHour = (at: Date): number => {
  const hour = hourFormatter.formatToParts(at).find((part) => part.type === 'hour')?.value ?? '0';
  return Number(hour) % 24;
};

export const bandForHour = (hour: number): TimeBand => {
  for (const band of TIME_BANDS) {
    const { start, end } = TIME_BAND_HOURS[band];
    const inside = start < end ? hour >= start && hour < end : hour >= start || hour < end;
    if (inside) return band;
  }
  return 'night';
};

export const timeBandAt = (at: Date): TimeBand => bandForHour(harareHour(at));

/** The local hours a band covers, in order (night: 20,21,…,23,0,…,4). */
export const bandHours = (band: TimeBand): number[] => {
  const { start, end } = TIME_BAND_HOURS[band];
  const length = (end - start + 24) % 24;
  return Array.from({ length }, (_, i) => (start + i) % 24);
};

/** Fraction of the day a band covers (night = 9/24). */
export const bandShareOfDay = (band: TimeBand): number => bandHours(band).length / 24;

export const formatHour = (hour: number): string => `${String(hour % 24).padStart(2, '0')}:00`;
