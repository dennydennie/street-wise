import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';
import {
  REPORT_FLAG_REASONS,
  REPORT_NOTE_MAX_LENGTH,
  REPORT_TYPES,
  REPORT_VOTES,
  type ReportFlagReason,
  type ReportType,
  type ReportVote,
} from '@streetwise/shared';

const NUMBER = String.raw`-?\d+(\.\d+)?`;

export class ListReportsQuery {
  @ApiProperty({ description: 'minLng,minLat,maxLng,maxLat', example: '31.03,-17.84,31.06,-17.82' })
  @Matches(new RegExp(`^${NUMBER},${NUMBER},${NUMBER},${NUMBER}$`), { message: 'bbox must be minLng,minLat,maxLng,maxLat' })
  bbox: string;
}

export class CreateReportDto {
  @ApiProperty({ enum: REPORT_TYPES })
  @IsIn(REPORT_TYPES)
  type: ReportType;

  @ApiProperty({ example: -17.8292 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 31.0522 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ maxLength: REPORT_NOTE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(REPORT_NOTE_MAX_LENGTH)
  note?: string;

  /** Quick "pin" while driving: saved as a draft to finish later, never shown on the map. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  draft?: boolean;
}

export class UpdateReportDto {
  @ApiPropertyOptional({ enum: REPORT_TYPES })
  @IsOptional()
  @IsIn(REPORT_TYPES)
  type?: ReportType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ nullable: true, maxLength: REPORT_NOTE_MAX_LENGTH })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(REPORT_NOTE_MAX_LENGTH)
  note?: string | null;

  /** Turns a draft pin into a live report. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class VoteDto {
  @ApiProperty({ enum: REPORT_VOTES })
  @IsIn(REPORT_VOTES)
  vote: ReportVote;
}

export class FlagDto {
  @ApiProperty({ enum: REPORT_FLAG_REASONS })
  @IsIn(REPORT_FLAG_REASONS)
  reason: ReportFlagReason;

  @ApiPropertyOptional({ description: "Also hide everything this reporter posts, for me" })
  @IsOptional()
  @IsBoolean()
  blockReporter?: boolean;
}

export class CreateBlockDto {
  /** Reporters are never identified to other users, so a block names one of their reports. */
  @ApiProperty()
  @IsUUID()
  reportId: string;
}
