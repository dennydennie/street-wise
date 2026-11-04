import type { BriefingPriority, ReportType } from '@streetwise/shared';
import {
  type BriefingReport,
  compareBriefings,
  computeAreaStats,
  isHistoricallyRelevant,
  peakWindowOf,
  priorityFor,
} from './briefing-engine';
import { writeTemplateBriefing } from './briefing-writer';
import { timeBandAt } from './time-bands';

const NOW = new Date('2026-11-04T08:00:00Z'); // 10:00 in Harare
const DAY = 86_400_000;
/** Harare 13:00 and 22:00 on the same day. */
const AT_1300 = new Date('2026-11-04T11:00:00Z');
const AT_2200 = new Date('2026-11-04T20:00:00Z');

/** A report `daysAgo` days back at Harare local `hour`, long expired. */
const past = (type: ReportType, daysAgo: number, hour: number, extra: Partial<BriefingReport> = {}): BriefingReport => {
  const capturedAt = new Date(Date.UTC(2026, 10, 4 - daysAgo, hour - 2, 15));
  return { type, status: 'live', capturedAt, expiresAt: new Date(capturedAt.getTime() + DAY), stillThereCount: 0, tags: [], ...extra };
};

const nightCrime = (): BriefingReport[] =>
  [19, 20, 21, 21, 22, 22, 20, 23].map((hour, i) => past('crime_hotspot', 10 + i * 8, hour, { tags: ['smash_and_grab'] }));

describe('time-aware relevance', () => {
  it('night-concentrated crime is not relevant at 13:00', () => {
    const stats = computeAreaStats(nightCrime(), timeBandAt(AT_1300), NOW);
    const crime = stats.items.find((item) => item.type === 'crime_hotspot')!;
    expect(timeBandAt(AT_1300)).toBe('midday');
    expect(crime.relevantNow).toBe(false);
    expect(stats.alert).toBe(false);
    expect(stats.priority).toBe('low');
    expect(crime.peakBand).toBe('night');
  });

  it('the same crime is relevant and alerts at 22:00', () => {
    const stats = computeAreaStats(nightCrime(), timeBandAt(AT_2200), NOW);
    const crime = stats.items.find((item) => item.type === 'crime_hotspot')!;
    expect(timeBandAt(AT_2200)).toBe('night');
    expect(crime.relevantNow).toBe(true);
    expect(stats.alert).toBe(true);
    expect(stats.score).toBeGreaterThanOrEqual(5);
  });

  it('needs at least 3 reports before history alone is relevant', () => {
    const hourly = new Array(24).fill(0);
    hourly[22] = 2;
    expect(isHistoricallyRelevant(hourly, 'night')).toBe(false);
    hourly[21] = 1;
    expect(isHistoricallyRelevant(hourly, 'night')).toBe(true);
  });

  it('a live report is always relevant, whatever the hour', () => {
    const live: BriefingReport = {
      type: 'robot_out',
      status: 'live',
      capturedAt: new Date(NOW.getTime() - 3_600_000),
      expiresAt: new Date(NOW.getTime() + 3_600_000),
      stillThereCount: 0,
      tags: [],
    };
    for (const at of [AT_1300, AT_2200, new Date('2026-11-04T04:00:00Z')]) {
      const stats = computeAreaStats([live], timeBandAt(at), NOW);
      expect(stats.items[0].relevantNow).toBe(true);
      expect(stats.items[0].liveCount).toBe(1);
    }
  });

  it('evenly spread history is never "relevant now" on its own', () => {
    const potholes = [1, 5, 9, 13, 17, 21].map((hour, i) => past('pothole', 40 + i, hour));
    for (const at of [AT_1300, AT_2200]) {
      expect(computeAreaStats(potholes, timeBandAt(at), NOW).items[0].relevantNow).toBe(false);
    }
  });

  it('describes the peak window', () => {
    const stats = computeAreaStats(nightCrime(), 'night', NOW);
    expect(stats.items[0].peakHours).toBe('20:00–23:00');
    expect(stats.hourly.reduce((a, b) => a + b, 0)).toBe(8);
    expect(peakWindowOf(new Array(24).fill(1)).hours).toBeGreaterThan(8);
  });
});

describe('priority and ordering', () => {
  it('maps scores to priorities', () => {
    expect(priorityFor(12)).toBe('high');
    expect(priorityFor(11.9)).toBe('medium');
    expect(priorityFor(5)).toBe('medium');
    expect(priorityFor(4.9)).toBe('low');
  });

  it('sorts alert, then priority, then score, then distance', () => {
    const entry = (name: string, alert: boolean, priority: BriefingPriority, score: number, distanceM: number) => ({
      name, alert, priority, score, distanceM,
    });
    const sorted = [
      entry('near-low', false, 'low', 1, 10),
      entry('far-high', true, 'high', 30, 1500),
      entry('near-high', true, 'high', 30, 100),
      entry('medium', true, 'medium', 8, 50),
      entry('higher-score', true, 'high', 40, 1900),
    ].sort(compareBriefings);
    expect(sorted.map((e) => e.name)).toEqual(['higher-score', 'near-high', 'far-high', 'medium', 'near-low']);
  });

  it('leads with the most dangerous relevant item', () => {
    const live = (type: ReportType): BriefingReport => ({
      type,
      status: 'live',
      capturedAt: new Date(NOW.getTime() - 3_600_000),
      expiresAt: new Date(NOW.getTime() + 3_600_000),
      stillThereCount: 0,
      tags: [],
    });
    const stats = computeAreaStats([live('pothole'), live('robot_out'), ...nightCrime()], 'night', NOW);
    expect(stats.items.map((item) => item.type)).toEqual(['crime_hotspot', 'robot_out', 'pothole']);
    const text = writeTemplateBriefing({ areaId: 'a', areaName: 'Seke × Cripps', timeBand: 'night', items: stats.items });
    expect(text.headline).toBe("Crime hotspot — don't stop at the robot");
    expect(text.advice).toBe(
      '8 smash-and-grabs reported, mostly 20:00–23:00. Windows up, doors locked, valuables out of sight. Also: robot out, pothole.',
    );
  });

  it('says "mostly at night" when nothing is relevant now', () => {
    const stats = computeAreaStats(nightCrime(), 'midday', NOW);
    const text = writeTemplateBriefing({ areaId: 'a', areaName: 'Seke × Cripps', timeBand: 'midday', items: stats.items });
    expect(text.headline).toBe('Crime hotspot — mostly at night');
    expect(text.advice).toMatch(/^Nothing pressing right now\. 8 smash-and-grabs reported/);
  });
});
