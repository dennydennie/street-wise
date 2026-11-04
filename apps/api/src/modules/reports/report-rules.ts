import {
  REPORT_FLAGS_TO_REVIEW,
  REPORT_GONE_VOTES_TO_HIDE,
  REPORT_LIFETIME_HOURS,
  type MyReportStatus,
  type ReportFlagReason,
  type ReportStatus,
  type ReportType,
  type ReportVote,
} from '@streetwise/shared';

const HOUR_MS = 60 * 60 * 1000;

export const reportExpiry = (type: ReportType, from: Date): Date =>
  new Date(from.getTime() + REPORT_LIFETIME_HOURS[type] * HOUR_MS);

export const isOnMap = (report: { status: ReportStatus; expiresAt: Date | null }, now: Date): boolean =>
  report.status === 'live' && report.expiresAt !== null && report.expiresAt.getTime() > now.getTime();

export type VoteTally = { stillThere: number; gone: number };
type VotableReport = { type: ReportType; status: ReportStatus; expiresAt: Date | null };

/**
 * State of a live report after a vote and the recount of distinct voters.
 * - "still there" pushes the expiry out to a full lifetime from now (never shortens it).
 * - `REPORT_GONE_VOTES_TO_HIDE` distinct "gone" votes take it off the map.
 */
export const applyVote = (
  report: VotableReport,
  vote: ReportVote,
  tally: VoteTally,
  now: Date,
): { status: ReportStatus; expiresAt: Date | null } => {
  if (report.status !== 'live') return { status: report.status, expiresAt: report.expiresAt };

  let expiresAt = report.expiresAt;
  if (vote === 'still_there') {
    const extended = reportExpiry(report.type, now);
    if (!expiresAt || extended.getTime() > expiresAt.getTime()) expiresAt = extended;
  }
  const status: ReportStatus = tally.gone >= REPORT_GONE_VOTES_TO_HIDE ? 'gone' : 'live';
  return { status, expiresAt };
};

/** A plate or a person's name goes to review at once; anything else after enough distinct flags. */
export const shouldSendToReview = (reason: ReportFlagReason, distinctFlags: number): boolean =>
  reason === 'names_person_or_plate' || distinctFlags >= REPORT_FLAGS_TO_REVIEW;

/** What "My reports" shows: a report voted off the map, removed, or timed out is `expired`. */
export const myReportStatus = (report: { status: ReportStatus; expiresAt: Date | null }, now: Date): MyReportStatus => {
  switch (report.status) {
    case 'draft':
      return 'draft';
    case 'review':
      return 'review';
    case 'live':
      return isOnMap(report, now) ? 'live' : 'expired';
    default:
      return 'expired';
  }
};
