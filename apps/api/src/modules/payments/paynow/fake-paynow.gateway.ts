import { FAKE_PAYNOW_INTEGRATION_KEY } from '../../../config/env.schema';
import { formatAmount, PaynowGateway, PaynowInitiated, PaynowInitiation, PaynowResult } from './paynow-gateway';
import { signPaynowMessage } from './paynow-message';
import { readPaynowResult } from './read-result';

/**
 * Local stand-in for Paynow (PAYNOW_MODE=fake). Nothing leaves the machine.
 * To complete a payment, call `POST /payments/:ref/fake-result`, which builds
 * a correctly hashed callback with `buildResult` and feeds it through the same
 * result handler Paynow would hit. The pass still activates only there.
 */
export class FakePaynowGateway implements PaynowGateway {
  constructor(private readonly apiPublicBaseUrl: string) {}

  async initiateMobile(payment: PaynowInitiation & { phone: string }): Promise<PaynowInitiated> {
    return {
      pollUrl: null,
      redirectUrl: null,
      instructions: `FAKE PAYNOW: no prompt was sent to ${payment.phone}. Complete it with POST /payments/${payment.reference}/fake-result (or wait for FAKE_PAYNOW_AUTO_SETTLE_SECONDS).`,
      paynowReference: `FAKE-${payment.reference}`,
    };
  }

  async initiateWeb(payment: PaynowInitiation): Promise<PaynowInitiated> {
    return {
      pollUrl: null,
      redirectUrl: `${this.apiPublicBaseUrl}/payments/${payment.reference}/fake-checkout`,
      instructions: null,
      paynowReference: `FAKE-${payment.reference}`,
    };
  }

  readResult(rawBody: string): PaynowResult | null {
    return readPaynowResult(rawBody, FAKE_PAYNOW_INTEGRATION_KEY);
  }

  static buildResult(reference: string, amountCents: number, status: 'Paid' | 'Cancelled' | 'Failed', error?: string): string {
    return signPaynowMessage(
      [
        ['reference', reference],
        ['paynowreference', `FAKE-${reference}`],
        ['amount', formatAmount(amountCents)],
        ['status', status],
        ['pollurl', ''],
        ...(error ? ([['error', error]] as const) : []),
      ],
      FAKE_PAYNOW_INTEGRATION_KEY,
    );
  }

  /** What a fake EcoCash wallet does: numbers ending 0000 have no money. */
  static ecocashOutcome(phone: string | null): { status: 'Paid' | 'Failed'; error?: string } {
    return phone?.endsWith('0000') ? { status: 'Failed', error: 'Insufficient balance' } : { status: 'Paid' };
  }
}
