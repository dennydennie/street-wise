import { REPORT_LIFETIME_HOURS } from '@streetwise/shared';
import { applyVote, myReportStatus, reportExpiry, shouldSendToReview } from './report-rules';

const now = new Date('2026-11-04T08:00:00Z');
const live = { type: 'pothole' as const, status: 'live' as const, expiresAt: new Date('2026-11-05T08:00:00Z') };

describe('report votes', () => {
  it('stays live with two distinct gone votes', () => {
    expect(applyVote(live, 'gone', { stillThere: 0, gone: 2 }, now).status).toBe('live');
  });

  it('hides the report on the third distinct gone vote', () => {
    expect(applyVote(live, 'gone', { stillThere: 1, gone: 3 }, now).status).toBe('gone');
  });

  it('"still there" extends the expiry to a full lifetime from now', () => {
    const result = applyVote(live, 'still_there', { stillThere: 1, gone: 0 }, now);
    expect(result.expiresAt?.getTime()).toBe(now.getTime() + REPORT_LIFETIME_HOURS.pothole * 3_600_000);
  });

  it('"still there" never shortens an expiry', () => {
    const farFuture = { ...live, expiresAt: new Date('2027-06-01T00:00:00Z') };
    expect(applyVote(farFuture, 'still_there', { stillThere: 1, gone: 0 }, now).expiresAt).toEqual(farFuture.expiresAt);
  });

  it('does not revive a report under review', () => {
    expect(applyVote({ ...live, status: 'review' }, 'still_there', { stillThere: 5, gone: 0 }, now).status).toBe('review');
  });

  it('a robot-out report lives for hours, not days', () => {
    expect(reportExpiry('robot_out', now).getTime() - now.getTime()).toBe(6 * 3_600_000);
  });
});

describe('report flags and status', () => {
  it('sends a report naming a person or plate to review immediately', () => {
    expect(shouldSendToReview('names_person_or_plate', 1)).toBe(true);
    expect(shouldSendToReview('spam', 1)).toBe(false);
    expect(shouldSendToReview('spam', 2)).toBe(true);
  });

  it('reports a timed-out or voted-off report as expired', () => {
    expect(myReportStatus({ status: 'live', expiresAt: new Date(now.getTime() - 1) }, now)).toBe('expired');
    expect(myReportStatus({ status: 'gone', expiresAt: live.expiresAt }, now)).toBe('expired');
    expect(myReportStatus(live, now)).toBe('live');
  });
});
