import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Tendai' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  displayName?: string;

  /** When the user accepted the community rules. The server stores its own clock, not the client's. */
  @ApiPropertyOptional({ example: '2026-11-04T08:00:00Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  agreedToRulesAt?: string;
}
