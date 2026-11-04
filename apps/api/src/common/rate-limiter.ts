import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Small in-process sliding-window limiter for expensive per-user calls
 * (analysis, transcription). Per instance only; Redis can replace it when the
 * API runs on more than one node.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  /** Seconds to wait, or 0 (and the hit is recorded). */
  take(key: string, now = Date.now()): number {
    const recent = (this.hits.get(key) ?? []).filter((at) => at > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000));
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return 0;
  }

  /** Throws 429 `RATE_LIMITED` when over the limit. */
  consume(key: string, now = Date.now()): void {
    const retryAfterSeconds = this.take(key, now);
    if (retryAfterSeconds > 0) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.', retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) if (!times.some((at) => at > now - this.windowMs)) this.hits.delete(key);
  }
}
