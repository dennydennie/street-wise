import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class ListCamerasQuery {
  /** Only cameras changed after this instant (use the previous response's `serverTime`). */
  @ApiPropertyOptional({ example: '2026-11-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  since?: string;
}
