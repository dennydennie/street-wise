import { mapPaynowStatus, parseAmountCents, PaynowResult } from './paynow-gateway';
import { fieldValue, parsePaynowMessage, verifyPaynowHash } from './paynow-message';

/** Shared by the real and fake gateways: verify the hash with `integrationKey`, then read the fields. */
export const readPaynowResult = (rawBody: string, integrationKey: string): PaynowResult | null => {
  const fields = parsePaynowMessage(rawBody);
  if (!fields || !verifyPaynowHash(fields, integrationKey)) return null;

  const reference = fieldValue(fields, 'reference');
  const status = fieldValue(fields, 'status');
  const amountCents = parseAmountCents(fieldValue(fields, 'amount') ?? '');
  if (!reference || !status || Number.isNaN(amountCents)) return null;

  return {
    reference,
    paynowReference: fieldValue(fields, 'paynowreference') ?? null,
    amountCents,
    status: mapPaynowStatus(status),
    error: fieldValue(fields, 'error')?.trim().slice(0, 160) || null,
  };
};
