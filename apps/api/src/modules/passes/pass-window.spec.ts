import { nextPassWindow } from './pass-window';

const now = new Date('2026-11-04T08:00:00Z');

describe('nextPassWindow', () => {
  it('starts now when there is no pass', () => {
    expect(nextPassWindow(null, 7, now)).toEqual({ startsAt: now, endsAt: new Date('2026-11-11T08:00:00Z') });
  });

  it('starts now when the previous pass has ended', () => {
    expect(nextPassWindow(new Date('2026-11-01T00:00:00Z'), 1, now).startsAt).toEqual(now);
  });

  it('stacks onto the end of an active pass', () => {
    const activeUntil = new Date('2026-11-06T12:00:00Z');
    expect(nextPassWindow(activeUntil, 30, now)).toEqual({
      startsAt: activeUntil,
      endsAt: new Date('2026-12-06T12:00:00Z'),
    });
  });

  it('stacks repeatedly (day + day + week = 9 days)', () => {
    const first = nextPassWindow(null, 1, now);
    const second = nextPassWindow(first.endsAt, 1, now);
    const third = nextPassWindow(second.endsAt, 7, now);
    expect(third.endsAt).toEqual(new Date('2026-11-13T08:00:00Z'));
  });
});
