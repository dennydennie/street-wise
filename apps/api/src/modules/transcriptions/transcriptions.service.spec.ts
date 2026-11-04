import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { NoTranscriber, OpenAiTranscriber, TranscriptionError } from './transcriber';
import { TRANSCRIPTION_OFF_MESSAGE, TranscriptionsService } from './transcriptions.service';

const audio = { buffer: Buffer.from('fake'), mimeType: 'audio/webm', fileName: 'note.webm' };

describe('TranscriptionsService', () => {
  it('answers 503 with a pointer to on-device recognition when the provider is none', async () => {
    const service = new TranscriptionsService(new NoTranscriber());
    const call = service.transcribe(audio, 'en');
    await expect(call).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(call).rejects.toMatchObject({ response: { message: TRANSCRIPTION_OFF_MESSAGE } });
    expect(() => service.assertEnabled()).toThrow(ServiceUnavailableException);
  });

  it('returns text, language and provider from OpenAI', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ text: ' robot not working ' }), { status: 200 }));
    const service = new TranscriptionsService(new OpenAiTranscriber('sk-test', 'gpt-4o-mini-transcribe', fetchImpl as unknown as typeof fetch));
    await expect(service.transcribe(audio, 'sn')).resolves.toEqual({ text: 'robot not working', language: 'sn', provider: 'openai' });
    const form = (fetchImpl.mock.calls[0] as unknown as [string, { body: FormData }])[1].body;
    expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
    expect(form.get('language')).toBe('sn');
  });

  it('maps a provider failure to 502', async () => {
    const failing = { provider: 'openai' as const, transcribe: jest.fn(async () => { throw new TranscriptionError('Transcription failed'); }) };
    await expect(new TranscriptionsService(failing).transcribe(audio)).rejects.toBeInstanceOf(BadGatewayException);
  });
});
