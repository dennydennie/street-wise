import type { PassId, ReportType, TimeBand } from './enums';

/** Zimbabwe numbers in E.164: +263 followed by nine digits (e.g. +263771234567). */
export const ZW_PHONE_PATTERN = /^\+263[1-9]\d{8}$/;
/** EcoCash wallets are Econet mobile numbers: +263 77x / 78x. */
export const ECOCASH_PHONE_PATTERN = /^\+2637[78]\d{7}$/;

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_VERIFY_ATTEMPTS = 5;
/** At most this many codes per phone inside `OTP_REQUEST_WINDOW_SECONDS`. */
export const OTP_MAX_REQUESTS_PER_WINDOW = 3;
export const OTP_REQUEST_WINDOW_SECONDS = 15 * 60;
/** Minimum gap between two codes to the same phone. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Distinct "gone" votes that take a report off the map. */
export const REPORT_GONE_VOTES_TO_HIDE = 3;
/** Distinct flags that send a live report to review (a `names_person_or_plate` flag does it alone). */
export const REPORT_FLAGS_TO_REVIEW = 2;
export const REPORT_NOTE_MAX_LENGTH = 140;

/** How long a live report stays on the map, and how far a "still there" vote pushes it out. */
export const REPORT_LIFETIME_HOURS: Record<ReportType, number> = {
  pothole: 30 * 24,
  robot_out: 6,
  kombi_stop: 30 * 24,
  flooding: 12,
  crime_hotspot: 7 * 24,
  camera: 30 * 24,
};

export type PassCatalogueItem = {
  id: PassId;
  label: string;
  /** Price in US cents. */
  priceCents: number;
  currency: 'USD';
  durationDays: number;
  autoRenews: false;
};

/** Plus passes. No auto-renew: buying while a pass is active stacks onto its end date. */
export const PASS_CATALOGUE: readonly PassCatalogueItem[] = [
  { id: 'day', label: 'Day pass', priceCents: 50, currency: 'USD', durationDays: 1, autoRenews: false },
  { id: 'week', label: 'Week pass', priceCents: 150, currency: 'USD', durationDays: 7, autoRenews: false },
  { id: 'month', label: 'Month pass', priceCents: 400, currency: 'USD', durationDays: 30, autoRenews: false },
];

export const findPass = (id: string): PassCatalogueItem | undefined => PASS_CATALOGUE.find((pass) => pass.id === id);

/** `SWZ-` followed by six characters from an alphabet without 0/O/1/I. */
export const PAYMENT_REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const PAYMENT_REFERENCE_PATTERN = /^SWZ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

// ── Voice reports, areas and briefings ──────────────
/** Raw speech text kept with a report; only ever returned to its reporter. */
export const REPORT_TRANSCRIPT_MAX_LENGTH = 500;
/** Redacted, public one-liner derived from the transcript. */
export const REPORT_SUMMARY_MAX_LENGTH = 160;
export const REPORT_SEVERITY_MIN = 1;
export const REPORT_SEVERITY_MAX = 5;
/** A pin captured offline may be posted up to this many days later. */
export const REPORT_CAPTURED_AT_MAX_AGE_DAYS = 7;

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  pothole: 'Pothole',
  robot_out: 'Robot out',
  kombi_stop: 'Kombi stop',
  flooding: 'Flooding',
  crime_hotspot: 'Crime hotspot',
  camera: 'Camera',
};

/** How much one item of each type weighs in a briefing score. */
export const REPORT_TYPE_WEIGHTS: Record<ReportType, number> = {
  crime_hotspot: 5,
  flooding: 4,
  robot_out: 3,
  pothole: 2,
  kombi_stop: 2,
  camera: 2,
};

/** Africa/Harare local hours, start inclusive, end exclusive; `night` wraps midnight. */
export const TIME_BAND_HOURS: Record<TimeBand, { start: number; end: number }> = {
  morning: { start: 5, end: 10 },
  midday: { start: 10, end: 16 },
  evening: { start: 16, end: 20 },
  night: { start: 20, end: 5 },
};
export const BRIEFING_TIME_ZONE = 'Africa/Harare';

/** Reports within this distance of an area centre belong to it. */
export const AREA_RADIUS_M = 200;
export const BRIEFING_HISTORY_DAYS = 90;
export const BRIEFING_DEFAULT_RADIUS_M = 2000;
export const BRIEFING_MAX_RADIUS_M = 10000;
export const BRIEFING_DEFAULT_LIMIT = 10;
export const BRIEFING_MAX_LIMIT = 30;
export const BRIEFING_HIGH_SCORE = 12;
export const BRIEFING_MEDIUM_SCORE = 5;

export const HARARE_CENTRE = { lat: -17.8292, lng: 31.0522 } as const;

/** Server transcription upload limit. */
export const TRANSCRIPTION_MAX_BYTES = 2 * 1024 * 1024;
