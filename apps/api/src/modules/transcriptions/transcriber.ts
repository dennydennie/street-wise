import { Logger } from '@nestjs/common';
import type { TranscriptionLanguage, TranscriptionProvider } from '@streetwise/shared';

export const TRANSCRIBER = Symbol('TRANSCRIBER');

export type AudioUpload = { buffer: Buffer; mimeType: string; fileName: string };

export interface Transcriber {
  readonly provider: TranscriptionProvider;
  /** Null when the provider is off (`none`). Throws TranscriptionError when the provider fails. */
  transcribe(audio: AudioUpload, language?: TranscriptionLanguage): Promise<string | null>;
}

export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

/** TRANSCRIPTION_PROVIDER=none: the app transcribes on the device. */
export class NoTranscriber implements Transcriber {
  readonly provider = 'none' as const;
  async transcribe(): Promise<null> {
    return null;
  }
}

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const TIMEOUT_MS = 15_000;
/** Prompt hint for local place names and slang; improves recognition of non-English words. */
const PROMPT =
  'Harare road report. Robot, kombi, ZUPCO, mushikashika, gomba, mvura, mbavha, Seke, Cripps, Samora Machel, Julius Nyerere, Rotten Row, Mbare.';

/** TRANSCRIPTION_PROVIDER=openai: OpenAI audio transcriptions over plain fetch. */
export class OpenAiTranscriber implements Transcriber {
  readonly provider = 'openai' as const;
  private readonly logger = new Logger('OpenAiTranscriber');

  constructor(private readonly apiKey: string, private readonly model: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async transcribe(audio: AudioUpload, language?: TranscriptionLanguage): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio.buffer)], { type: audio.mimeType }), audio.fileName);
    form.append('model', this.model);
    form.append('response_format', 'json');
    form.append('prompt', PROMPT);
    // OpenAI takes ISO-639-1 hints for English and Shona; Ndebele is left to auto-detection.
    if (language === 'en' || language === 'sn') form.append('language', language);

    let response: Response;
    try {
      response = await this.fetchImpl(OPENAI_TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`OpenAI transcription unreachable: ${(error as Error).message}`);
      throw new TranscriptionError('Transcription service is unreachable');
    }
    if (!response.ok) {
      this.logger.warn(`OpenAI transcription failed with HTTP ${response.status}`);
      throw new TranscriptionError('Transcription failed');
    }
    const body = (await response.json()) as { text?: unknown };
    if (typeof body.text !== 'string') throw new TranscriptionError('Transcription returned no text');
    return body.text.trim();
  }
}
