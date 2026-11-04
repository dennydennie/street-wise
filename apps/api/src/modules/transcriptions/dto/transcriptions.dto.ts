import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { TRANSCRIPTION_LANGUAGES, type TranscriptionLanguage } from '@streetwise/shared';

export class TranscriptionRequestDto {
  @ApiPropertyOptional({ enum: TRANSCRIPTION_LANGUAGES })
  @IsOptional()
  @IsIn(TRANSCRIPTION_LANGUAGES)
  language?: TranscriptionLanguage;
}
