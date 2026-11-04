import { BadRequestException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { AppConfigService } from '../../config/app-config.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PassesService } from '../passes/passes.service';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { FakePaynowGateway } from './paynow/fake-paynow.gateway';
import { signPaynowMessage } from './paynow/paynow-message';

const userId = '11111111-1111-4111-8111-111111111111';

const setup = () => {
  const payment = {
    id: 'pay-1',
    reference: 'SWZ-7Q4K2M',
    userId,
    passId: 'week',
    method: 'ecocash',
    status: 'pending',
    amountCents: 150,
    currency: 'USD',
    paidAt: null,
    failureReason: null,
    paynowReference: null,
    payerPhone: '+263771234821',
    redirectUrl: null,
    instructions: null,
    createdAt: new Date('2026-11-04T08:00:00Z'),
  } as unknown as Payment;

  const paymentRepo = {
    findOne: jest.fn(async () => payment),
    save: jest.fn(async (value: Payment) => value),
  };
  const manager = { getRepository: jest.fn(() => paymentRepo) };
  const dataSource = { transaction: jest.fn(async (work: (m: unknown) => unknown) => work(manager)) };
  const passes = { grantForPayment: jest.fn(async () => ({ endsAt: new Date('2026-11-11T16:51:00Z') })) };
  const notifications = { paymentReceipt: jest.fn(async () => undefined) };
  const config = { paynowMode: 'fake' } as AppConfigService;

  const service = new PaymentsService(
    config,
    dataSource as unknown as DataSource,
    passes as unknown as PassesService,
    paymentRepo as unknown as Repository<Payment>,
    new FakePaynowGateway('http://localhost:4100'),
    notifications as unknown as NotificationsService,
  );
  return { service, payment, passes, notifications };
};

describe('PaymentsService Paynow result', () => {
  it('activates the pass on a verified paid callback', async () => {
    const { service, payment, passes } = setup();
    await service.handlePaynowResult(FakePaynowGateway.buildResult('SWZ-7Q4K2M', 150, 'Paid'));
    expect(payment.status).toBe('paid');
    expect(passes.grantForPayment).toHaveBeenCalledWith(
      expect.anything(),
      { userId, passId: 'week', paymentId: 'pay-1' },
      expect.any(Date),
    );
  });

  it('rejects a callback with a bad hash and grants nothing', async () => {
    const { service, passes } = setup();
    const forged = signPaynowMessage(
      [['reference', 'SWZ-7Q4K2M'], ['paynowreference', 'x'], ['amount', '1.50'], ['status', 'Paid'], ['pollurl', '']],
      'not-our-key',
    );
    await expect(service.handlePaynowResult(forged)).rejects.toBeInstanceOf(BadRequestException);
    expect(passes.grantForPayment).not.toHaveBeenCalled();
  });

  it('rejects a paid callback for the wrong amount', async () => {
    const { service, passes } = setup();
    await expect(service.handlePaynowResult(FakePaynowGateway.buildResult('SWZ-7Q4K2M', 50, 'Paid'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(passes.grantForPayment).not.toHaveBeenCalled();
  });

  it('does not grant (or text a receipt) twice when Paynow repeats the callback', async () => {
    const { service, passes, notifications } = setup();
    const body = FakePaynowGateway.buildResult('SWZ-7Q4K2M', 150, 'Paid');
    await service.handlePaynowResult(body);
    await service.handlePaynowResult(body);
    expect(passes.grantForPayment).toHaveBeenCalledTimes(1);
    expect(notifications.paymentReceipt).toHaveBeenCalledTimes(1);
  });

  it('texts a receipt to the payer once the pass is granted', async () => {
    const { service, notifications } = setup();
    await service.handlePaynowResult(FakePaynowGateway.buildResult('SWZ-7Q4K2M', 150, 'Paid'));
    expect(notifications.paymentReceipt).toHaveBeenCalledWith('+263771234821', {
      phone: '+263771234821',
      passLabel: 'Week pass',
      amountCents: 150,
      reference: 'SWZ-7Q4K2M',
      endsAt: new Date('2026-11-11T16:51:00Z'),
    });
  });

  it('client polling never activates a pass', async () => {
    const { service, passes } = setup();
    const polled = await service.getForUser(userId, 'SWZ-7Q4K2M');
    expect(polled.status).toBe('pending');
    expect(passes.grantForPayment).not.toHaveBeenCalled();
  });

  it('records a cancelled payment without granting', async () => {
    const { service, payment, passes } = setup();
    await service.handlePaynowResult(FakePaynowGateway.buildResult('SWZ-7Q4K2M', 150, 'Cancelled'));
    expect(payment.status).toBe('cancelled');
    expect(passes.grantForPayment).not.toHaveBeenCalled();
  });
});

describe('PaymentsService fake EcoCash auto-settle', () => {
  it('fails a wallet ending 0000 with "Insufficient balance" through the result handler', async () => {
    const { service, payment, passes } = setup();
    await service.settleFakeEcocash('SWZ-7Q4K2M', 150, '+263770000000');
    expect(payment.status).toBe('failed');
    expect(payment.failureReason).toBe('Insufficient balance');
    expect(passes.grantForPayment).not.toHaveBeenCalled();
    expect((await service.getForUser(userId, 'SWZ-7Q4K2M')).failureReason).toBe('Insufficient balance');
  });

  it('pays any other wallet and activates the pass', async () => {
    const { service, payment, passes } = setup();
    await service.settleFakeEcocash('SWZ-7Q4K2M', 150, '+263771234567');
    expect(payment.status).toBe('paid');
    expect(payment.failureReason).toBeNull();
    expect(passes.grantForPayment).toHaveBeenCalledTimes(1);
  });

  it('gives a default reason when Paynow reports a plain failure', async () => {
    const { service, payment } = setup();
    await service.handlePaynowResult(FakePaynowGateway.buildResult('SWZ-7Q4K2M', 150, 'Failed'));
    expect(payment.failureReason).toBe('Payment failed');
  });
});
