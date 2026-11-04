import {
  BRIEFING_HIGH_SCORE,
  BRIEFING_MEDIUM_SCORE,
  REPORT_TYPE_LABELS,
  REPORT_TYPE_WEIGHTS,
  REPORT_TYPES,
  TIME_BANDS,
  type BriefingItem,
  type BriefingPriority,
  type ReportStatus,
  type ReportType,
  type TimeBand,
} from '@streetwise/shared';
import { isOnMap } from '../reports/report-rules';
import { bandHours, bandShareOfDay, formatHour, harareHour } from './time-bands';

/**
 * Time-aware relevance for one area. See docs/briefings.md for the rules in
 * plain words. Everything here is pure so it can be tested without a database.
 */

/** A report as the briefing sees it: no reporter, no transcript. */
export type BriefingReport = {
  type: ReportType;
  status: ReportStatus;
  capturedAt: Date;
  expiresAt: Date | null;
  stillThereCount: number;
  tags: string[];
};

/** Share of the current band must beat its share of the day by this factor… */
export const RELEVANCE_LIFT = 1.25;
/** …and the type needs at least this many reports in the window. */
export const RELEVANCE_MIN_REPORTS = 3;
/** Pseudo-reports spread over the day in proportion to band length (Laplace smoothing). */
export const SMOOTHING_PSEUDO_COUNTS = 4;
export const RECENCY_HALF_LIFE_DAYS = 30;
/** A peak window must hold this share of reports to be called "mostly". */
const PEAK_SHARE = 0.6;
/** Windows wider than this are "at all hours", not a peak. */
export const MAX_PEAK_HOURS = 8;

const DAY_MS = 86_400_000;

export type ItemStats = BriefingItem & {
  weight: number;
  /** liveCount×3 + recency-decayed history + confirmations×0.5 */
  intensity: number;
  /** True when the peak window is narrow enough to say "mostly hh–hh". */
  concentrated: boolean;
  dominantTag: string | null;
};

export type AreaStats = {
  items: ItemStats[];
  hourly: number[];
  score: number;
  priority: BriefingPriority;
  alert: boolean;
};

export const emptyHistogram = (): number[] => new Array(24).fill(0);

export const histogramOf = (reports: readonly { capturedAt: Date }[]): number[] => {
  const hourly = emptyHistogram();
  for (const report of reports) hourly[harareHour(report.capturedAt)] += 1;
  return hourly;
};

export const bandCounts = (hourly: readonly number[]): Record<TimeBand, number> =>
  Object.fromEntries(TIME_BANDS.map((band) => [band, bandHours(band).reduce((sum, hour) => sum + hourly[hour], 0)])) as Record<
    TimeBand,
    number
  >;

/** (count in band + k·bandShare) / (total + k): a sparse history pulls towards "evenly spread". */
export const smoothedBandShare = (hourly: readonly number[], band: TimeBand): number => {
  const total = hourly.reduce((a, b) => a + b, 0);
  return (bandCounts(hourly)[band] + SMOOTHING_PSEUDO_COUNTS * bandShareOfDay(band)) / (total + SMOOTHING_PSEUDO_COUNTS);
};

/** History alone makes a type relevant now when it clusters in the current band. */
export const isHistoricallyRelevant = (hourly: readonly number[], band: TimeBand): boolean => {
  const total = hourly.reduce((a, b) => a + b, 0);
  return total >= RELEVANCE_MIN_REPORTS && smoothedBandShare(hourly, band) >= RELEVANCE_LIFT * bandShareOfDay(band);
};

/** Band with the highest reports-per-hour; ties go to the earlier band of the day. */
export const peakBandOf = (hourly: readonly number[]): TimeBand => {
  const counts = bandCounts(hourly);
  let best: TimeBand = TIME_BANDS[0];
  for (const band of TIME_BANDS) {
    if (counts[band] / bandHours(band).length > counts[best] / bandHours(best).length) best = band;
  }
  return best;
};

/** Narrowest circular window of whole hours holding ≥60% of reports, e.g. "19:00–23:00". */
export const peakWindowOf = (hourly: readonly number[]): { start: number; hours: number } => {
  const total = hourly.reduce((a, b) => a + b, 0);
  if (total === 0) return { start: 0, hours: 24 };
  const needed = Math.ceil(total * PEAK_SHARE);
  for (let hours = 1; hours <= 24; hours += 1) {
    let best: { start: number; sum: number } | null = null;
    for (let start = 0; start < 24; start += 1) {
      let sum = 0;
      for (let i = 0; i < hours; i += 1) sum += hourly[(start + i) % 24];
      if (sum >= needed && (!best || sum > best.sum)) best = { start, sum };
    }
    if (best) return { start: best.start, hours };
  }
  return { start: 0, hours: 24 };
};

export const formatWindow = (window: { start: number; hours: number }): string =>
  window.hours >= 24 ? '00:00–24:00' : `${formatHour(window.start)}–${formatHour(window.start + window.hours)}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const priorityFor = (score: number): BriefingPriority =>
  score >= BRIEFING_HIGH_SCORE ? 'high' : score >= BRIEFING_MEDIUM_SCORE ? 'medium' : 'low';

export const PRIORITY_RANK: Record<BriefingPriority, number> = { high: 2, medium: 1, low: 0 };

/**
 * `reports` are the area's reports captured in the history window (all statuses
 * but draft/removed). `now` decides what is live and how old a report is;
 * `band` is the time-of-day band being briefed for.
 */
export const computeAreaStats = (reports: readonly BriefingReport[], band: TimeBand, now: Date): AreaStats => {
  const items: ItemStats[] = [];
  for (const type of REPORT_TYPES) {
    const ofType = reports.filter((report) => report.type === type);
    if (ofType.length === 0) continue;

    const hourly = histogramOf(ofType);
    const live = ofType.filter((report) => isOnMap(report, now));
    const confirmations = ofType.reduce((sum, report) => sum + report.stillThereCount, 0);
    const decayedHistory = ofType
      .filter((report) => !isOnMap(report, now))
      .reduce((sum, report) => sum + 0.5 ** (Math.max(0, now.getTime() - report.capturedAt.getTime()) / DAY_MS / RECENCY_HALF_LIFE_DAYS), 0);
    const latest = ofType.reduce((max, report) => (report.capturedAt > max ? report.capturedAt : max), ofType[0].capturedAt);
    const window = peakWindowOf(hourly);
    const concentrated = window.hours <= MAX_PEAK_HOURS;
    const relevantNow = live.length > 0 || isHistoricallyRelevant(hourly, band);
    const intensity = live.length * 3 + decayedHistory + confirmations * 0.5;
    const peakHours = formatWindow(window);

    const tagCounts = new Map<string, number>();
    for (const report of ofType) for (const tag of report.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    const [dominantTag, dominantCount] = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

    const parts: string[] = [];
    if (live.length > 0) parts.push(`${live.length} live now`);
    parts.push(`${plural(ofType.length, 'report', 'reports')} in 90 days${concentrated ? `, mostly ${peakHours}` : ', at all hours'}`);
    if (confirmations > 0) parts.push(plural(confirmations, 'confirmation', 'confirmations'));

    items.push({
      type,
      label: REPORT_TYPE_LABELS[type],
      liveCount: live.length,
      reportsLast90d: ofType.length,
      confirmations,
      latestAt: latest.toISOString(),
      peakBand: peakBandOf(hourly),
      peakHours,
      shareInCurrentBand: round(bandCounts(hourly)[band] / ofType.length),
      relevantNow,
      summary: parts.join('; '),
      weight: REPORT_TYPE_WEIGHTS[type],
      intensity: round(intensity),
      concentrated,
      dominantTag: dominantTag && dominantCount * 2 > ofType.length ? dominantTag : null,
    });
  }

  // Relevant first, then the more dangerous type, then the stronger signal.
  items.sort(
    (a, b) =>
      Number(b.relevantNow) - Number(a.relevantNow) || b.weight - a.weight || b.intensity - a.intensity,
  );
  const score = round(items.filter((item) => item.relevantNow).reduce((sum, item) => sum + item.weight * item.intensity, 0));
  const priority = priorityFor(score);
  return {
    items,
    hourly: histogramOf(reports),
    score,
    priority,
    alert: PRIORITY_RANK[priority] >= PRIORITY_RANK.medium && items.some((item) => item.relevantNow),
  };
};

/** alert desc, priority desc, score desc, distance asc. */
export const compareBriefings = (
  a: { alert: boolean; priority: BriefingPriority; score: number; distanceM: number },
  b: { alert: boolean; priority: BriefingPriority; score: number; distanceM: number },
): number =>
  Number(b.alert) - Number(a.alert) ||
  PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
  b.score - a.score ||
  a.distanceM - b.distanceM;

/** Strips engine-only fields for the API response. */
export const toBriefingItem = (item: ItemStats): BriefingItem => ({
  type: item.type,
  label: item.label,
  liveCount: item.liveCount,
  reportsLast90d: item.reportsLast90d,
  confirmations: item.confirmations,
  latestAt: item.latestAt,
  peakBand: item.peakBand,
  peakHours: item.peakHours,
  shareInCurrentBand: item.shareInCurrentBand,
  relevantNow: item.relevantNow,
  summary: item.summary,
});

const round = (value: number) => Math.round(value * 100) / 100;
