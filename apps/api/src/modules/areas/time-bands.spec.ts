import { bandForHour, bandHours, bandShareOfDay, harareHour, timeBandAt } from './time-bands';

describe('Africa/Harare time bands', () => {
  it('reads the hour in Harare (UTC+2), not UTC', () => {
    expect(harareHour(new Date('2026-11-04T11:00:00Z'))).toBe(13);
    expect(harareHour(new Date('2026-11-04T22:30:00Z'))).toBe(0);
  });

  it('maps hours to bands at the edges', () => {
    expect(bandForHour(4)).toBe('night');
    expect(bandForHour(5)).toBe('morning');
    expect(bandForHour(9)).toBe('morning');
    expect(bandForHour(10)).toBe('midday');
    expect(bandForHour(15)).toBe('midday');
    expect(bandForHour(16)).toBe('evening');
    expect(bandForHour(19)).toBe('evening');
    expect(bandForHour(20)).toBe('night');
    expect(bandForHour(23)).toBe('night');
    expect(bandForHour(0)).toBe('night');
  });

  it('keeps night as one band across midnight in Harare time', () => {
    // 21:59 UTC = 23:59 Harare; 22:01 UTC = 00:01 Harare the next day; 02:59 UTC = 04:59.
    expect(timeBandAt(new Date('2026-11-04T21:59:00Z'))).toBe('night');
    expect(timeBandAt(new Date('2026-11-04T22:01:00Z'))).toBe('night');
    expect(timeBandAt(new Date('2026-11-05T02:59:00Z'))).toBe('night');
    expect(timeBandAt(new Date('2026-11-05T03:00:00Z'))).toBe('morning');
    // 19:00 UTC is already 21:00 in Harare.
    expect(timeBandAt(new Date('2026-11-04T19:00:00Z'))).toBe('night');
  });

  it('night covers 20:00–05:00 (9 hours)', () => {
    expect(bandHours('night')).toEqual([20, 21, 22, 23, 0, 1, 2, 3, 4]);
    expect(bandShareOfDay('night')).toBeCloseTo(9 / 24);
    expect(['morning', 'midday', 'evening', 'night'].reduce((sum, band) => sum + bandHours(band as never).length, 0)).toBe(24);
  });
});
