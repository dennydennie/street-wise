import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { TRANSCRIPTION_LANGUAGES, TRANSCRIPTION_MAX_BYTES } from '@streetwise/shared';
import { SlidingWindowRateLimiter } from '../../common/rate-limiter';
import type { AuthenticatedUser } from '../auth/auth-token';
import { CurrentUser } from '../auth/current-user.decorator';
import { TranscriptionRequestDto } from './dto/transcriptions.dto';
import { TranscriptionsService } from './transcriptions.service';

/** Accepted containers. Some recorders send a generic type, so the extension is checked too. */
const AUDIO_TYPES = new Set([
  'audio/webm', 'audio/ogg', 'audio/opus', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac',
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/mpeg', 'audio/mp3', 'video/webm', 'video/mp4',
]);
const AUDIO_EXTENSIONS = /\.(webm|ogg|oga|opus|m4a|mp4|wav|mp3|mpeg|mpga)$/i;

const limiter = new SlidingWindowRateLimiter(10, 60_000);

/** The part of multer's file object we use (memory storage). */
type UploadedAudio = { buffer: Buffer; mimetype: string; originalname: string; size: number };

@ApiTags('transcriptions')
@ApiBearerAuth()
@Controller('transcriptions')
export class TranscriptionsController {
  constructor(private readonly transcriptions: TranscriptionsService) {}

  /** Fallback for devices without speech recognition. 503 when TRANSCRIPTION_PROVIDER=none. */
  @Post()
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['audio'],
      properties: { audio: { type: 'string', format: 'binary' }, language: { type: 'string', enum: [...TRANSCRIPTION_LANGUAGES] } },
    },
  })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: TRANSCRIPTION_MAX_BYTES, files: 1 } }))
  async transcribe(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() audio: UploadedAudio | undefined,
    @Body() body: TranscriptionRequestDto,
  ) {
    this.transcriptions.assertEnabled();
    if (!audio) throw new BadRequestException('Send the recording as multipart field "audio"');
    const mimeType = audio.mimetype.split(';')[0].trim().toLowerCase();
    if (!AUDIO_TYPES.has(mimeType) && !AUDIO_EXTENSIONS.test(audio.originalname)) {
      throw new UnsupportedMediaTypeException('Audio must be webm, ogg, m4a, mp4, wav or mpeg');
    }
    limiter.consume(user.userId);
    return this.transcriptions.transcribe(
      { buffer: audio.buffer, mimeType: AUDIO_TYPES.has(mimeType) ? mimeType : 'application/octet-stream', fileName: audio.originalname || 'audio.webm' },
      body.language,
    );
  }
}
