import { randomInt } from 'node:crypto';
import { PAYMENT_REFERENCE_ALPHABET } from '@streetwise/shared';

/** e.g. `SWZ-7Q4K2M`: short enough to read out on a support call. */
export const generatePaymentReference = (): string => {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += PAYMENT_REFERENCE_ALPHABET[randomInt(PAYMENT_REFERENCE_ALPHABET.length)];
  return `SWZ-${suffix}`;
};
