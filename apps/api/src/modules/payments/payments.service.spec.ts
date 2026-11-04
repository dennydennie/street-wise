import { BadRequestException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { AppConfigService } from '../../config/app-config.service';
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
    paynowReference: null,
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
  const passes = { grantForPayment: jest.fn(async () => ({})) };
  const config = { paynowMode: 'fake' } as AppConfigService;

  const service = new PaymentsService(
    config,
    dataSource as unknown as DataSource,
    passes as unknown as PassesService,
    paymentRepo as unknown as Repository<Payment>,
    new FakePaynowGateway('http://localhost:4100'),
  );
  return { service, payment, passes };
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

  it('does not grant twice when Paynow repeats the callback', async () => {
    const { service, passes } = setup();
    const body = FakePaynowGateway.buildResult('SWZ-7Q4K2M', 150, 'Paid');
    await service.handlePaynowResult(body);
    await service.handlePaynowResult(body);
    expect(passes.grantForPayment).toHaveBeenCalledTimes(1);
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
