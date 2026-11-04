import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  REPORT_FLAG_REASONS,
  REPORT_NOTE_MAX_LENGTH,
  REPORT_TRANSCRIPT_MAX_LENGTH,
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
  /** Optional when `transcript` is given: the server infers it (422 REPORT_TYPE_UNKNOWN if it cannot). */
  @ApiPropertyOptional({ enum: REPORT_TYPES })
  @ValidateIf((body: CreateReportDto) => body.type !== undefined || body.transcript === undefined)
  @IsIn(REPORT_TYPES, { message: `type must be one of ${REPORT_TYPES.join(', ')} (or send a transcript)` })
  type?: ReportType;

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

  /** What the driver said. Kept private to the reporter; a redacted summary is made public. */
  @ApiPropertyOptional({ maxLength: REPORT_TRANSCRIPT_MAX_LENGTH, example: 'robot not working at Seke and Cripps' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(REPORT_TRANSCRIPT_MAX_LENGTH)
  transcript?: string;

  /** Direction of travel, degrees 0–359. */
  @ApiPropertyOptional({ minimum: 0, maximum: 359 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(359)
  heading?: number;

  /** When the driver saw it (offline pins). Not in the future, at most 7 days old. Defaults to now. */
  @ApiPropertyOptional({ example: '2026-11-04T07:45:00+02:00' })
  @IsOptional()
  @IsISO8601({ strict: true })
  capturedAt?: string;
}

export class AnalyzeReportDto {
  @ApiProperty({ maxLength: REPORT_TRANSCRIPT_MAX_LENGTH, example: 'smash and grab at the lights, Seke and Cripps' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(REPORT_TRANSCRIPT_MAX_LENGTH)
  transcript: string;
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
