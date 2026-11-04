import assert from 'node:assert/strict';
import { test } from 'node:test';
import shared from '../dist/index.js';

const { PASS_CATALOGUE, createPaymentSchema, otpRequestSchema, bboxSchema, PAYMENT_REFERENCE_PATTERN } = shared;

test('pass catalogue prices match the published Plus prices', () => {
  assert.deepEqual(
    PASS_CATALOGUE.map((pass) => [pass.id, pass.priceCents, pass.durationDays]),
    [['day', 50, 1], ['week', 150, 7], ['month', 400, 30]],
  );
});

test('phone must be +263 format', () => {
  assert.equal(otpRequestSchema.safeParse({ phone: '+263771234567' }).success, true);
  assert.equal(otpRequestSchema.safeParse({ phone: '0771234567' }).success, false);
});

test('ecocash payments need an Econet number', () => {
  assert.equal(createPaymentSchema.safeParse({ passId: 'day', method: 'ecocash' }).success, false);
  assert.equal(createPaymentSchema.safeParse({ passId: 'day', method: 'ecocash', phone: '+263771234567' }).success, true);
  assert.equal(createPaymentSchema.safeParse({ passId: 'day', method: 'paynow_web' }).success, true);
});

test('bbox parses minLng,minLat,maxLng,maxLat', () => {
  assert.deepEqual(bboxSchema.parse('31.0,-17.9,31.1,-17.8'), [31.0, -17.9, 31.1, -17.8]);
  assert.equal(bboxSchema.safeParse('a,b').success, false);
});

test('payment reference format', () => {
  assert.match('SWZ-7Q4K2M', PAYMENT_REFERENCE_PATTERN);
  assert.doesNotMatch('SWZ-0O1I23', PAYMENT_REFERENCE_PATTERN);
});

test('a report needs a type unless a transcript is given', () => {
  const { createReportSchema } = shared;
  assert.equal(createReportSchema.safeParse({ lat: -17.83, lng: 31.05 }).success, false);
  assert.equal(createReportSchema.safeParse({ lat: -17.83, lng: 31.05, transcript: 'robot not working' }).success, true);
  assert.equal(createReportSchema.safeParse({ lat: -17.83, lng: 31.05, type: 'pothole', heading: 360 }).success, false);
});

test('area briefing carries a 24-hour histogram', () => {
  const { areaBriefingSchema } = shared;
  const base = {
    areaId: '5e0c0000-0000-4000-8000-000000000001', name: 'Seke × Cripps', lat: -17.84, lng: 31.03, distanceM: 10,
    priority: 'high', score: 20, alert: true, headline: 'h', advice: 'a', items: [],
  };
  assert.equal(areaBriefingSchema.safeParse({ ...base, hourly: new Array(24).fill(0) }).success, true);
  assert.equal(areaBriefingSchema.safeParse({ ...base, hourly: [1, 2] }).success, false);
});
