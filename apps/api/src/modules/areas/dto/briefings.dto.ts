import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsLatitude, IsLongitude, IsOptional, Max, Min } from 'class-validator';
import { BRIEFING_DEFAULT_LIMIT, BRIEFING_DEFAULT_RADIUS_M, BRIEFING_MAX_LIMIT, BRIEFING_MAX_RADIUS_M } from '@streetwise/shared';

export class AtQuery {
  @ApiPropertyOptional({ description: 'Time to brief for (ISO 8601). Picks the Africa/Harare time band; default now.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  at?: string;
}

export class BriefingsQuery extends AtQuery {
  @ApiProperty({ example: -17.8445 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 31.0335 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ default: BRIEFING_DEFAULT_RADIUS_M, maximum: BRIEFING_MAX_RADIUS_M })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BRIEFING_MAX_RADIUS_M)
  radiusM?: number;

  @ApiPropertyOptional({ default: BRIEFING_DEFAULT_LIMIT, maximum: BRIEFING_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BRIEFING_MAX_LIMIT)
  limit?: number;
}
