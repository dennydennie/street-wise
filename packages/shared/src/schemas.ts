import { z } from 'zod';
import {
  CAMERA_CHECKS,
  CAMERA_SOURCES,
  MY_REPORT_STATUSES,
  PASS_IDS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REPORT_FLAG_REASONS,
  REPORT_STATUSES,
  REPORT_TYPES,
  REPORT_VOTES,
} from './enums';
import {
  ECOCASH_PHONE_PATTERN,
  OTP_LENGTH,
  PAYMENT_REFERENCE_PATTERN,
  REPORT_NOTE_MAX_LENGTH,
  ZW_PHONE_PATTERN,
} from './rules';

const isoDate = z.string().datetime({ offset: true });
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const zwPhoneSchema = z.string().regex(ZW_PHONE_PATTERN, 'Phone must be in +263 format, e.g. +263771234567');

// ── Auth ─────────────────────────────────────────────
export const otpRequestSchema = z.object({ phone: zwPhoneSchema });
export const otpRequestResponseSchema = z.object({ expiresInSeconds: z.number().int(), resendAfterSeconds: z.number().int() });
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
export const createReportSchema = z.object({
  type: z.enum(REPORT_TYPES),
  lat: latitude,
  lng: longitude,
  note: z.string().max(REPORT_NOTE_MAX_LENGTH).optional(),
  draft: z.boolean().optional(),
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
  type: z.enum(REPORT_TYPES),
  lat: latitude,
  lng: longitude,
  note: z.string().nullable(),
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
