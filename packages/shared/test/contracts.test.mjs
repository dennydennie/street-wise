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
