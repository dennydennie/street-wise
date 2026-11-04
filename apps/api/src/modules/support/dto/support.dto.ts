import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { SupportCategory } from '../../notifications/notifications.service';

export const SUPPORT_CATEGORIES: readonly SupportCategory[] = ['bug', 'wrong_camera', 'billing', 'other'];

export class SupportMessageDto {
  @ApiProperty({ enum: SUPPORT_CATEGORIES })
  @IsIn(SUPPORT_CATEGORIES)
  category: SupportCategory;

  @ApiProperty({ minLength: 5, maxLength: 2000 })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({ description: 'Where to reply, if the sender wants an e-mail answer' })
  @IsOptional()
  @IsEmail()
  replyEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}
