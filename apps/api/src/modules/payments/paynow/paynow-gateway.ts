export const PAYNOW_GATEWAY = Symbol('PAYNOW_GATEWAY');

export type PaynowInitiation = {
  reference: string;
  amountCents: number;
  description: string;
  returnUrl: string;
  resultUrl: string;
};

export type PaynowInitiated = {
  pollUrl: string | null;
  redirectUrl: string | null;
  instructions: string | null;
  paynowReference: string | null;
};

export type PaynowResultStatus = 'paid' | 'pending' | 'cancelled' | 'failed';

/** A result callback whose hash checked out. */
export type PaynowResult = {
  reference: string;
  paynowReference: string | null;
  amountCents: number;
  status: PaynowResultStatus;
  /** Paynow's error text, when it sends one with a failed status. */
  error: string | null;
};

export interface PaynowGateway {
  /** Paynow Express: pushes a USSD/PIN prompt to the payer's EcoCash phone. */
  initiateMobile(payment: PaynowInitiation & { phone: string; method: 'ecocash' }): Promise<PaynowInitiated>;
  /** Paynow web checkout: returns the URL to send the payer to. */
  initiateWeb(payment: PaynowInitiation): Promise<PaynowInitiated>;
  /** Authenticates and reads a result callback body. Null when the hash does not verify. */
  readResult(rawBody: string): PaynowResult | null;
}

export class PaynowGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaynowGatewayError';
  }
}

/** Paynow statuses that mean the money is with the merchant. */
const PAID = new Set(['paid', 'awaiting delivery', 'delivered']);
const CANCELLED = new Set(['cancelled']);
const FAILED = new Set(['failed', 'disputed', 'refunded', 'error']);

export const mapPaynowStatus = (status: string): PaynowResultStatus => {
  const value = status.trim().toLowerCase();
  if (PAID.has(value)) return 'paid';
  if (CANCELLED.has(value)) return 'cancelled';
  if (FAILED.has(value)) return 'failed';
  return 'pending';
};

export const formatAmount = (cents: number): string => (cents / 100).toFixed(2);

/** Parses "1.50" into 150; NaN for anything that is not a plain decimal amount. */
export const parseAmountCents = (amount: string): number =>
  /^\d+(\.\d{1,2})?$/.test(amount.trim()) ? Math.round(Number(amount) * 100) : Number.NaN;
