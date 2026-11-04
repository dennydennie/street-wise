import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ZW_PHONE_PATTERN } from '@streetwise/shared';

export class OtpRequestDto {
  @ApiProperty({ example: '+263771234567' })
  @Matches(ZW_PHONE_PATTERN, { message: 'phone must be in +263 format, e.g. +263771234567' })
  phone: string;
}

export class OtpVerifyDto extends OtpRequestDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  @ApiPropertyOptional({ example: 'Pixel 8' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceLabel?: string;
}
