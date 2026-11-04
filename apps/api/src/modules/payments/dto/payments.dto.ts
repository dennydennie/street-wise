import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches, ValidateIf } from 'class-validator';
import { ECOCASH_PHONE_PATTERN, PASS_IDS, PAYMENT_METHODS, type PassId, type PaymentMethod } from '@streetwise/shared';

export class CreatePaymentDto {
  @ApiProperty({ enum: PASS_IDS })
  @IsIn(PASS_IDS)
  passId: PassId;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  method: PaymentMethod;

  /** Required for EcoCash: the Econet number that will get the PIN prompt. */
  @ApiPropertyOptional({ example: '+263771234567' })
  @ValidateIf((body: CreatePaymentDto) => body.method === 'ecocash' || body.phone !== undefined)
  @Matches(ECOCASH_PHONE_PATTERN, { message: 'phone must be an Econet number in +263 format (+26377… or +26378…)' })
  phone?: string;
}

export class FakeResultDto {
  @ApiProperty({ enum: ['paid', 'cancelled', 'failed'] })
  @IsOptional()
  @IsIn(['paid', 'cancelled', 'failed'])
  outcome?: 'paid' | 'cancelled' | 'failed';
}
