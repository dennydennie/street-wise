import type { ReportAnalysis } from '@streetwise/shared';

export const REPORT_ANALYZER = Symbol('REPORT_ANALYZER');

/** Turns a driver's spoken report into a type, a redacted public summary, a severity and tags. */
export interface ReportAnalyzer {
  analyze(transcript: string): Promise<ReportAnalysis>;
}
