import { Logger } from '@nestjs/common';
import {
  formatAmount,
  PaynowGateway,
  PaynowGatewayError,
  PaynowInitiated,
  PaynowInitiation,
  PaynowResult,
} from './paynow-gateway';
import { fieldValue, parsePaynowMessage, PaynowField, signPaynowMessage, verifyPaynowHash } from './paynow-message';
import { readPaynowResult } from './read-result';

const INITIATE_URL = 'https://www.paynow.co.zw/interface/initiatetransaction';
const REMOTE_URL = 'https://www.paynow.co.zw/interface/remotetransaction';
const TIMEOUT_MS = 15_000;

export type PaynowHttpConfig = {
  integrationId: string;
  integrationKey: string;
  /** Required in test mode (the integration's own e-mail); the payer's e-mail otherwise. */
  authEmail?: string;
};

/**
 * Real Paynow over HTTPS. `sandbox` and `live` both use this; Paynow's test
 * mode is a property of the integration, not a different host.
 */
export class PaynowHttpGateway implements PaynowGateway {
  private readonly logger = new Logger('Paynow');

  constructor(private readonly config: PaynowHttpConfig) {}

  async initiateMobile(payment: PaynowInitiation & { phone: string; method: 'ecocash' }): Promise<PaynowInitiated> {
    // Paynow wants the local format for the wallet: 0771234567.
    const localPhone = payment.phone.replace(/^\+263/, '0');
    const reply = await this.post(REMOTE_URL, [
      ...this.baseFields(payment),
      ['phone', localPhone],
      ['method', payment.method],
    ]);
    return {
      pollUrl: fieldValue(reply, 'pollurl') ?? null,
      redirectUrl: null,
      instructions: fieldValue(reply, 'instructions') ?? 'Check your phone and enter your EcoCash PIN to approve.',
      paynowReference: fieldValue(reply, 'paynowreference') ?? null,
    };
  }

  async initiateWeb(payment: PaynowInitiation): Promise<PaynowInitiated> {
    const reply = await this.post(INITIATE_URL, this.baseFields(payment));
    const redirectUrl = fieldValue(reply, 'browserurl');
    if (!redirectUrl) throw new PaynowGatewayError('Paynow returned no browserurl');
    return { pollUrl: fieldValue(reply, 'pollurl') ?? null, redirectUrl, instructions: null, paynowReference: null };
  }

  readResult(rawBody: string): PaynowResult | null {
    return readPaynowResult(rawBody, this.config.integrationKey);
  }

  private baseFields(payment: PaynowInitiation): PaynowField[] {
    return [
      ['id', this.config.integrationId],
      ['reference', payment.reference],
      ['amount', formatAmount(payment.amountCents)],
      ['additionalinfo', payment.description],
      ['returnurl', payment.returnUrl],
      ['resulturl', payment.resultUrl],
      ['authemail', this.config.authEmail ?? ''],
      ['status', 'Message'],
    ];
  }

  private async post(url: string, fields: PaynowField[]): Promise<PaynowField[]> {
    let text: string;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: signPaynowMessage(fields, this.config.integrationKey),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      text = await response.text();
    } catch (error) {
      this.logger.warn(`Paynow unreachable: ${(error as Error).message}`);
      throw new PaynowGatewayError('Paynow is unreachable');
    }

    const reply = parsePaynowMessage(text);
    if (!reply) throw new PaynowGatewayError('Paynow sent an unreadable reply');
    const status = fieldValue(reply, 'status')?.toLowerCase();
    if (status !== 'ok') {
      throw new PaynowGatewayError(fieldValue(reply, 'error') ?? 'Paynow refused the payment');
    }
    // Successful replies are signed; error replies are not.
    if (!verifyPaynowHash(reply, this.config.integrationKey)) {
      throw new PaynowGatewayError('Paynow reply failed hash verification');
    }
    return reply;
  }
}
