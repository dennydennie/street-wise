import { BadGatewayException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { TranscriptionLanguage, TranscriptionResponse } from '@streetwise/shared';
import { type AudioUpload, TRANSCRIBER, type Transcriber, TranscriptionError } from './transcriber';

export const TRANSCRIPTION_OFF_MESSAGE = 'Server transcription is off; use on-device speech recognition';

@Injectable()
export class TranscriptionsService {
  constructor(@Inject(TRANSCRIBER) private readonly transcriber: Transcriber) {}

  get enabled(): boolean {
    return this.transcriber.provider !== 'none';
  }

  /** 503 when off, 502 when the provider fails. */
  assertEnabled(): void {
    if (!this.enabled) throw new ServiceUnavailableException({ message: TRANSCRIPTION_OFF_MESSAGE });
  }

  async transcribe(audio: AudioUpload, language?: TranscriptionLanguage): Promise<TranscriptionResponse> {
    this.assertEnabled();
    let text: string | null;
    try {
      text = await this.transcriber.transcribe(audio, language);
    } catch (error) {
      if (error instanceof TranscriptionError) throw new BadGatewayException({ code: 'TRANSCRIPTION_FAILED', message: error.message });
      throw error;
    }
    if (text === null) throw new ServiceUnavailableException({ message: TRANSCRIPTION_OFF_MESSAGE });
    return { text, language: language ?? null, provider: this.transcriber.provider };
  }
}
