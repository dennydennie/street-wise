import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { findPass, type Payment as PaymentResponse } from '@streetwise/shared';
import { AppConfigService } from '../../config/app-config.service';
import { PassesService } from '../passes/passes.service';
import { CreatePaymentDto } from './dto/payments.dto';
import { Payment } from './entities/payment.entity';
import { generatePaymentReference } from './payment-reference';
import { FakePaynowGateway } from './paynow/fake-paynow.gateway';
import { PAYNOW_GATEWAY, PaynowGateway, PaynowGatewayError } from './paynow/paynow-gateway';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly config: AppConfigService,
    private readonly dataSource: DataSource,
    private readonly passes: PassesService,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @Inject(PAYNOW_GATEWAY) private readonly gateway: PaynowGateway,
  ) {}

  async create(userId: string, body: CreatePaymentDto): Promise<PaymentResponse> {
    const pass = findPass(body.passId);
    if (!pass) throw new BadRequestException('Unknown pass');
    if (body.method === 'ecocash' && !body.phone) throw new BadRequestException('EcoCash needs a phone number');

    const payment = await this.insertWithUniqueReference({
      userId,
      passId: pass.id,
      method: body.method,
      amountCents: pass.priceCents,
      currency: 'USD',
      payerPhone: body.method === 'ecocash' ? (body.phone ?? null) : null,
      status: 'created',
    });

    const initiation = {
      reference: payment.reference,
      amountCents: payment.amountCents,
      description: `StreetWise Plus ${pass.label}`,
      returnUrl: `${this.config.paynowReturnUrl}${this.config.paynowReturnUrl.includes('?') ? '&' : '?'}ref=${payment.reference}`,
      resultUrl: this.config.paynowResultUrl,
    };
    try {
      const started =
        body.method === 'ecocash'
          ? await this.gateway.initiateMobile({ ...initiation, phone: body.phone as string, method: 'ecocash' })
          : await this.gateway.initiateWeb(initiation);
      Object.assign(payment, {
        status: 'pending',
        pollUrl: started.pollUrl,
        redirectUrl: started.redirectUrl,
        instructions: started.instructions,
        paynowReference: started.paynowReference,
      });
      return toPaymentResponse(await this.payments.save(payment));
    } catch (error) {
      await this.payments.update({ id: payment.id }, { status: 'failed' });
      if (error instanceof PaynowGatewayError) {
        throw new BadGatewayException({ code: 'PAYNOW_UNAVAILABLE', message: error.message, reference: payment.reference });
      }
      throw error;
    }
  }

  /** For client polling. Read-only: it never activates a pass. */
  async getForUser(userId: string, reference: string): Promise<PaymentResponse> {
    const payment = await this.payments.findOne({ where: { reference, userId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return toPaymentResponse(payment);
  }

  async history(userId: string, now = new Date()): Promise<PaymentResponse[]> {
    const since = new Date(now);
    since.setUTCFullYear(since.getUTCFullYear() - 1);
    const rows = await this.payments.find({ where: { userId, createdAt: MoreThan(since) }, order: { createdAt: 'DESC' } });
    return rows.map(toPaymentResponse);
  }

  /**
   * Paynow's result callback: the ONLY place a pass is activated. The hash is
   * verified against our integration key, the amount must match what we
   * charged, and a replayed "paid" never grants twice.
   */
  async handlePaynowResult(rawBody: string, now = new Date()): Promise<{ status: string }> {
    const result = this.gateway.readResult(rawBody);
    if (!result) {
      this.logger.warn('Rejected Paynow result with a missing or invalid hash');
      throw new BadRequestException('Invalid Paynow message');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Payment);
      const payment = await repo.findOne({ where: { reference: result.reference }, lock: { mode: 'pessimistic_write' } });
      if (!payment) throw new NotFoundException('Unknown payment reference');
      if (payment.status === 'paid') return { status: 'paid' };

      if (result.amountCents !== payment.amountCents) {
        this.logger.error(`Paynow amount mismatch on ${payment.reference}: ${result.amountCents} != ${payment.amountCents}`);
        throw new BadRequestException('Amount does not match the payment');
      }

      payment.paynowReference = result.paynowReference ?? payment.paynowReference;
      if (result.status === 'paid') {
        payment.status = 'paid';
        payment.paidAt = now;
        await repo.save(payment);
        if (payment.userId) {
          await this.passes.grantForPayment(manager, { userId: payment.userId, passId: payment.passId, paymentId: payment.id }, now);
        }
      } else {
        payment.status = result.status === 'pending' ? 'pending' : result.status;
        await repo.save(payment);
      }
      return { status: payment.status };
    });
  }

  /** PAYNOW_MODE=fake only: simulates Paynow calling our result URL. */
  async completeFakePayment(reference: string, outcome: 'paid' | 'cancelled' | 'failed' = 'paid') {
    if (this.config.paynowMode !== 'fake') throw new NotFoundException();
    const payment = await this.payments.findOne({ where: { reference } });
    if (!payment) throw new NotFoundException('Payment not found');
    const status = outcome === 'paid' ? 'Paid' : outcome === 'cancelled' ? 'Cancelled' : 'Failed';
    return this.handlePaynowResult(FakePaynowGateway.buildResult(reference, payment.amountCents, status));
  }

  get isFakeMode(): boolean {
    return this.config.paynowMode === 'fake';
  }

  private async insertWithUniqueReference(values: Partial<Payment>): Promise<Payment> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = generatePaymentReference();
      if (await this.payments.exist({ where: { reference } })) continue;
      return this.payments.save(this.payments.create({ ...values, reference }));
    }
    throw new Error('Could not allocate a payment reference');
  }
}

export const toPaymentResponse = (p: Payment): PaymentResponse => ({
  reference: p.reference,
  passId: p.passId,
  method: p.method,
  status: p.status,
  amountCents: p.amountCents,
  currency: 'USD',
  redirectUrl: p.redirectUrl,
  instructions: p.instructions,
  createdAt: p.createdAt.toISOString(),
  paidAt: p.paidAt?.toISOString() ?? null,
});
