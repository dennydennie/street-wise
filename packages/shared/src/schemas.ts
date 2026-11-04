import { z } from 'zod';
import {
  CAMERA_CHECKS,
  BRIEFING_PRIORITIES,
  CAMERA_SOURCES,
  MAP_PROVIDERS,
  MY_REPORT_STATUSES,
  PASS_IDS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REPORT_FLAG_REASONS,
  REPORT_STATUSES,
  REPORT_TYPES,
  REPORT_VOTES,
  TIME_BANDS,
  TRANSCRIPTION_LANGUAGES,
  TRANSCRIPTION_PROVIDERS,
} from './enums';
import {
  BRIEFING_MAX_LIMIT,
  BRIEFING_MAX_RADIUS_M,
  ECOCASH_PHONE_PATTERN,
  OTP_LENGTH,
  PAYMENT_REFERENCE_PATTERN,
  REPORT_NOTE_MAX_LENGTH,
  REPORT_SEVERITY_MAX,
  REPORT_SEVERITY_MIN,
  REPORT_SUMMARY_MAX_LENGTH,
  REPORT_TRANSCRIPT_MAX_LENGTH,
  ZW_PHONE_PATTERN,
} from './rules';

const isoDate = z.string().datetime({ offset: true });
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const zwPhoneSchema = z.string().regex(ZW_PHONE_PATTERN, 'Phone must be in +263 format, e.g. +263771234567');

// ── Auth ─────────────────────────────────────────────
export const otpRequestSchema = z.object({ phone: zwPhoneSchema });
export const otpRequestResponseSchema = z.object({
  expiresInSeconds: z.number().int(),
  resendAfterSeconds: z.number().int(),
  /** Only when the API runs with OTP_DEV_ECHO=true (never in production). */
  devCode: z.string().optional(),
});
export const otpVerifySchema = z.object({
  phone: zwPhoneSchema,
  code: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`)),
  deviceLabel: z.string().max(80).optional(),
});
export const userSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().nullable(),
  displayName: z.string().nullable(),
  agreedToRulesAt: isoDate.nullable(),
  createdAt: isoDate,
});
export const otpVerifyResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresInSeconds: z.number().int(),
  isNewUser: z.boolean(),
  user: userSchema,
});
export const passkeySchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  createdAt: isoDate,
  lastUsedAt: isoDate.nullable(),
});
export const sessionSchema = z.object({
  id: z.string().uuid(),
  deviceLabel: z.string().nullable(),
  createdAt: isoDate,
  lastSeenAt: isoDate,
  current: z.boolean(),
});

// ── Users ────────────────────────────────────────────
export const updateMeSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  agreedToRulesAt: isoDate.optional(),
});

// ── Cameras ──────────────────────────────────────────
export const cameraSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lat: latitude,
  lng: longitude,
  checks: z.array(z.enum(CAMERA_CHECKS)),
  source: z.enum(CAMERA_SOURCES),
  confidence: z.number().min(0).max(1),
  active: z.boolean(),
  updatedAt: isoDate,
});
export const cameraListResponseSchema = z.object({ cameras: z.array(cameraSchema), serverTime: isoDate });

// ── Reports ──────────────────────────────────────────
/** `minLng,minLat,maxLng,maxLat` */
export const bboxSchema = z
  .string()
  .transform((value) => value.split(',').map(Number))
  .pipe(z.tuple([longitude, latitude, longitude, latitude]));
const reportTypeSchema = z.enum(REPORT_TYPES);
const severitySchema = z.number().int().min(REPORT_SEVERITY_MIN).max(REPORT_SEVERITY_MAX);
/**
 * `type` may be left out when a `transcript` is given: the server infers it
 * (422 `REPORT_TYPE_UNKNOWN` if it cannot). `capturedAt` must not be in the
 * future and at most 7 days old (server-checked).
 */
export const createReportSchema = z
  .object({
    type: reportTypeSchema.optional(),
    lat: latitude,
    lng: longitude,
    note: z.string().max(REPORT_NOTE_MAX_LENGTH).optional(),
    draft: z.boolean().optional(),
    transcript: z.string().trim().min(1).max(REPORT_TRANSCRIPT_MAX_LENGTH).optional(),
    heading: z.number().int().min(0).max(359).optional(),
    capturedAt: isoDate.optional(),
  })
  .refine((body) => body.type !== undefined || body.transcript !== undefined, {
    message: 'type is required unless a transcript is given',
    path: ['type'],
  });
export const updateReportSchema = z.object({
  type: z.enum(REPORT_TYPES).optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
  note: z.string().max(REPORT_NOTE_MAX_LENGTH).nullable().optional(),
  publish: z.boolean().optional(),
});
export const reportSchema = z.object({
  id: z.string().uuid(),
  type: reportTypeSchema,
  lat: latitude,
  lng: longitude,
  note: z.string().nullable(),
  areaId: z.string().uuid().nullable(),
  locationName: z.string().nullable(),
  /** Redacted (no plates, numbers or names); safe to show anyone. */
  summary: z.string().nullable(),
  severity: severitySchema,
  tags: z.array(z.string()),
  heading: z.number().int().nullable(),
  capturedAt: isoDate,
  /** Raw speech text: present only on the reporter's own reports. */
  transcript: z.string().nullable().optional(),
  status: z.enum(REPORT_STATUSES),
  stillThereCount: z.number().int(),
  goneCount: z.number().int(),
  expiresAt: isoDate.nullable(),
  createdAt: isoDate,
  isMine: z.boolean(),
});
export const myReportSchema = reportSchema.omit({ status: true }).extend({ status: z.enum(MY_REPORT_STATUSES) });
export const voteSchema = z.object({ vote: z.enum(REPORT_VOTES) });
export const flagSchema = z.object({ reason: z.enum(REPORT_FLAG_REASONS), blockReporter: z.boolean().optional() });
export const createBlockSchema = z.object({ reportId: z.string().uuid() });

// ── Report text analysis ────────────────────────────
export const analyzeReportSchema = z.object({ transcript: z.string().trim().min(1).max(REPORT_TRANSCRIPT_MAX_LENGTH) });
export const reportAnalysisSchema = z.object({
  type: reportTypeSchema.nullable(),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(REPORT_SUMMARY_MAX_LENGTH),
  severity: severitySchema,
  tags: z.array(z.string()),
  /** True when a plate, phone number or person's name was removed from `summary`. */
  redacted: z.boolean(),
});

// ── Areas & briefings ───────────────────────────────
export const briefingQuerySchema = z.object({
  lat: latitude,
  lng: longitude,
  radiusM: z.number().int().min(1).max(BRIEFING_MAX_RADIUS_M).optional(),
  at: isoDate.optional(),
  limit: z.number().int().min(1).max(BRIEFING_MAX_LIMIT).optional(),
});
export const briefingItemSchema = z.object({
  type: reportTypeSchema,
  label: z.string(),
  liveCount: z.number().int(),
  reportsLast90d: z.number().int(),
  confirmations: z.number().int(),
  latestAt: isoDate.nullable(),
  peakBand: z.enum(TIME_BANDS),
  /** e.g. "19:00–23:00" (Africa/Harare). */
  peakHours: z.string(),
  shareInCurrentBand: z.number().min(0).max(1),
  relevantNow: z.boolean(),
  summary: z.string(),
});
export const areaBriefingSchema = z.object({
  areaId: z.string().uuid(),
  name: z.string(),
  lat: latitude,
  lng: longitude,
  distanceM: z.number().int(),
  priority: z.enum(BRIEFING_PRIORITIES),
  score: z.number(),
  alert: z.boolean(),
  headline: z.string(),
  advice: z.string(),
  items: z.array(briefingItemSchema),
  /** Reports per Africa/Harare hour (0–23) over the last 90 days. */
  hourly: z.array(z.number().int()).length(24),
});
export const briefingResponseSchema = z.object({
  generatedAt: isoDate,
  at: isoDate,
  timeBand: z.enum(TIME_BANDS),
  areas: z.array(areaBriefingSchema),
});
export const areaDetailSchema = areaBriefingSchema.extend({ recent: z.array(reportSchema) });

// ── Passkeys (WebAuthn) ─────────────────────────────
/** WebAuthn JSON objects are passed through as-is (simplewebauthn / Credential Manager shapes). */
const webAuthnJson = z.record(z.string(), z.unknown());
export const passkeyRegistrationOptionsRequestSchema = z.object({ label: z.string().trim().max(80).optional() });
export const passkeyOptionsResponseSchema = z.object({
  challengeId: z.string().uuid(),
  /** PublicKeyCredentialCreationOptionsJSON (registration) or PublicKeyCredentialRequestOptionsJSON (authentication). */
  options: webAuthnJson,
});
export const passkeyRegistrationVerifySchema = z.object({
  challengeId: z.string().uuid(),
  /** RegistrationResponseJSON */
  response: webAuthnJson,
  label: z.string().trim().max(80).optional(),
});
export const passkeyAuthenticationOptionsRequestSchema = z.object({ phone: zwPhoneSchema.optional() });
export const passkeyAuthenticationVerifySchema = z.object({
  challengeId: z.string().uuid(),
  /** AuthenticationResponseJSON */
  response: webAuthnJson,
  deviceLabel: z.string().max(80).optional(),
});

// ── Public config ───────────────────────────────────
export const publicConfigSchema = z.object({
  map: z.object({
    provider: z.enum(MAP_PROVIDERS),
    tileUrlTemplate: z.string(),
    attribution: z.string(),
    maxZoom: z.number().int(),
  }),
  features: z.object({ serverTranscription: z.boolean(), passkeys: z.boolean(), llmAnalysis: z.boolean() }),
  harare: z.object({ lat: latitude, lng: longitude }),
});

// ── Transcription ───────────────────────────────────
export const transcriptionRequestSchema = z.object({ language: z.enum(TRANSCRIPTION_LANGUAGES).optional() });
export const transcriptionResponseSchema = z.object({
  text: z.string(),
  /** The language asked for, or null when the provider detected it. */
  language: z.enum(TRANSCRIPTION_LANGUAGES).nullable(),
  provider: z.enum(TRANSCRIPTION_PROVIDERS),
});

// ── Passes & payments ───────────────────────────────
export const passCatalogueItemSchema = z.object({
  id: z.enum(PASS_IDS),
  label: z.string(),
  priceCents: z.number().int(),
  currency: z.literal('USD'),
  durationDays: z.number().int(),
  autoRenews: z.literal(false),
});
export const myPassSchema = z.object({ active: z.boolean(), passId: z.enum(PASS_IDS).nullable(), endsAt: isoDate.nullable() });
export const paymentReferenceSchema = z.string().regex(PAYMENT_REFERENCE_PATTERN);
export const createPaymentSchema = z
  .object({ passId: z.enum(PASS_IDS), method: z.enum(PAYMENT_METHODS), phone: zwPhoneSchema.optional() })
  .refine((body) => body.method !== 'ecocash' || (body.phone !== undefined && ECOCASH_PHONE_PATTERN.test(body.phone)), {
    message: 'EcoCash needs an Econet number (+26377… or +26378…)',
    path: ['phone'],
  });
export const paymentSchema = z.object({
  reference: paymentReferenceSchema,
  passId: z.enum(PASS_IDS),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUSES),
  amountCents: z.number().int(),
  currency: z.literal('USD'),
  redirectUrl: z.string().url().nullable(),
  instructions: z.string().nullable(),
  createdAt: isoDate,
  paidAt: isoDate.nullable(),
  /** Why a payment failed or was cancelled (e.g. "Insufficient balance"); null otherwise. */
  failureReason: z.string().nullable(),
});

export type OtpRequest = z.infer<typeof otpRequestSchema>;
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;
export type OtpVerify = z.infer<typeof otpVerifySchema>;
export type OtpVerifyResponse = z.infer<typeof otpVerifyResponseSchema>;
export type User = z.infer<typeof userSchema>;
export type Passkey = z.infer<typeof passkeySchema>;
export type Session = z.infer<typeof sessionSchema>;
export type UpdateMe = z.infer<typeof updateMeSchema>;
export type Camera = z.infer<typeof cameraSchema>;
export type CameraListResponse = z.infer<typeof cameraListResponseSchema>;
export type CreateReport = z.infer<typeof createReportSchema>;
export type UpdateReport = z.infer<typeof updateReportSchema>;
export type Report = z.infer<typeof reportSchema>;
export type MyReport = z.infer<typeof myReportSchema>;
export type VoteRequest = z.infer<typeof voteSchema>;
export type FlagRequest = z.infer<typeof flagSchema>;
export type CreateBlock = z.infer<typeof createBlockSchema>;
export type MyPass = z.infer<typeof myPassSchema>;
export type CreatePayment = z.infer<typeof createPaymentSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type AnalyzeReport = z.infer<typeof analyzeReportSchema>;
export type ReportAnalysis = z.infer<typeof reportAnalysisSchema>;
export type BriefingQuery = z.infer<typeof briefingQuerySchema>;
export type BriefingItem = z.infer<typeof briefingItemSchema>;
export type AreaBriefing = z.infer<typeof areaBriefingSchema>;
export type BriefingResponse = z.infer<typeof briefingResponseSchema>;
export type AreaDetail = z.infer<typeof areaDetailSchema>;
export type PasskeyRegistrationOptionsRequest = z.infer<typeof passkeyRegistrationOptionsRequestSchema>;
export type PasskeyOptionsResponse = z.infer<typeof passkeyOptionsResponseSchema>;
export type PasskeyRegistrationVerify = z.infer<typeof passkeyRegistrationVerifySchema>;
export type PasskeyAuthenticationOptionsRequest = z.infer<typeof passkeyAuthenticationOptionsRequestSchema>;
export type PasskeyAuthenticationVerify = z.infer<typeof passkeyAuthenticationVerifySchema>;
export type PublicConfig = z.infer<typeof publicConfigSchema>;
export type TranscriptionRequest = z.infer<typeof transcriptionRequestSchema>;
export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;
