/** Every enum is a `const` tuple so the API, zod schemas and docs share one list. */

export const CAMERA_CHECKS = ['red_light', 'stop_line', 'phone_use', 'seatbelt'] as const;
export type CameraCheck = (typeof CAMERA_CHECKS)[number];

export const CAMERA_SOURCES = ['official', 'community'] as const;
export type CameraSource = (typeof CAMERA_SOURCES)[number];

export const REPORT_TYPES = ['pothole', 'robot_out', 'kombi_stop', 'flooding', 'crime_hotspot', 'camera'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/**
 * Stored lifecycle of a community report.
 * - `draft`: a quick pin the reporter will finish later; never shown on the map.
 * - `live`: on the map until `expiresAt`.
 * - `review`: flagged; off the map until a moderator decides.
 * - `gone`: hidden after enough distinct "gone" votes.
 * - `removed`: taken down by moderation.
 */
export const REPORT_STATUSES = ['draft', 'live', 'review', 'gone', 'removed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** What a reporter sees on "My reports": `expired` covers both time-outs and gone votes. */
export const MY_REPORT_STATUSES = ['draft', 'live', 'review', 'expired'] as const;
export type MyReportStatus = (typeof MY_REPORT_STATUSES)[number];

export const REPORT_VOTES = ['still_there', 'gone'] as const;
export type ReportVote = (typeof REPORT_VOTES)[number];

export const REPORT_FLAG_REASONS = ['names_person_or_plate', 'false_or_gone', 'abusive', 'spam', 'other'] as const;
export type ReportFlagReason = (typeof REPORT_FLAG_REASONS)[number];

export const PASS_IDS = ['day', 'week', 'month'] as const;
export type PassId = (typeof PASS_IDS)[number];

export const PAYMENT_METHODS = ['ecocash', 'paynow_web'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['created', 'pending', 'paid', 'failed', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SIGN_IN_METHODS = ['phone', 'passkey'] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

/** Africa/Harare local time-of-day bands used by briefings (see docs/briefings.md). */
export const TIME_BANDS = ['morning', 'midday', 'evening', 'night'] as const;
export type TimeBand = (typeof TIME_BANDS)[number];

export const BRIEFING_PRIORITIES = ['high', 'medium', 'low'] as const;
export type BriefingPriority = (typeof BRIEFING_PRIORITIES)[number];

/** en = English, sn = Shona, nd = Ndebele. */
export const TRANSCRIPTION_LANGUAGES = ['en', 'sn', 'nd'] as const;
export type TranscriptionLanguage = (typeof TRANSCRIPTION_LANGUAGES)[number];

export const TRANSCRIPTION_PROVIDERS = ['none', 'openai'] as const;
export type TranscriptionProvider = (typeof TRANSCRIPTION_PROVIDERS)[number];

export const MAP_PROVIDERS = ['mapbox', 'osm'] as const;
export type MapProvider = (typeof MAP_PROVIDERS)[number];
