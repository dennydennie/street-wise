const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Window for a newly paid pass. Passes never auto-renew; buying while one is
 * active stacks the new days onto the current end date instead of wasting them.
 */
export const nextPassWindow = (
  currentEndsAt: Date | null,
  durationDays: number,
  now: Date,
): { startsAt: Date; endsAt: Date } => {
  const startsAt = currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationDays * DAY_MS) };
};
