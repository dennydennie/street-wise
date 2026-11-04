import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PAYMENT_REFERENCE_PATTERN } from '@streetwise/shared';
import type { AuthenticatedUser } from '../auth/auth-token';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreatePaymentDto, FakeResultDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

const checkReference = (ref: string): string => {
  if (!PAYMENT_REFERENCE_PATTERN.test(ref)) throw new BadRequestException('Invalid payment reference');
  return ref;
};

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiBearerAuth()
  @Post('payments')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePaymentDto) {
    return this.payments.create(user.userId, body);
  }

  /** Paynow result URL. Body is Paynow's URL-encoded message; the hash is checked on the raw bytes' field order. */
  @Public()
  @Post('payments/paynow/result')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  async paynowResult(@Req() request: RawBodyRequest<Request>) {
    const raw = request.rawBody?.toString('utf8') ?? '';
    await this.payments.handlePaynowResult(raw);
    return 'OK';
  }

  @ApiBearerAuth()
  @Get('payments/:ref')
  get(@CurrentUser() user: AuthenticatedUser, @Param('ref') ref: string) {
    return this.payments.getForUser(user.userId, checkReference(ref));
  }

  @ApiBearerAuth()
  @Get('me/payments')
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.history(user.userId);
  }

  // ── PAYNOW_MODE=fake helpers (404 in any other mode; fake mode is refused in production) ──

  @Public()
  @Post('payments/:ref/fake-result')
  @HttpCode(200)
  fakeResult(@Param('ref') ref: string, @Body() body: FakeResultDto) {
    return this.payments.completeFakePayment(checkReference(ref), body.outcome);
  }

  @ApiExcludeEndpoint()
  @Public()
  @Get('payments/:ref/fake-checkout')
  @Header('Content-Type', 'text/html; charset=utf-8')
  fakeCheckout(@Param('ref') ref: string) {
    if (!this.payments.isFakeMode) throw new NotFoundException();
    const safe = checkReference(ref);
    const button = (outcome: string, label: string) =>
      `<form method="post" action="/payments/${safe}/fake-result"><input type="hidden" name="outcome" value="${outcome}"><button>${label}</button></form>`;
    return `<!doctype html><title>Fake Paynow</title><h1>Fake Paynow checkout</h1><p>Payment ${safe}</p>${button('paid', 'Pay')}${button('cancelled', 'Cancel')}`;
  }
}
