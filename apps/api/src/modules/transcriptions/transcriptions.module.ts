import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { NoTranscriber, OpenAiTranscriber, TRANSCRIBER, Transcriber } from './transcriber';
import { TranscriptionsController } from './transcriptions.controller';
import { TranscriptionsService } from './transcriptions.service';

@Module({
  controllers: [TranscriptionsController],
  providers: [
    TranscriptionsService,
    {
      provide: TRANSCRIBER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Transcriber =>
        config.transcriptionProvider === 'openai' && config.openaiApiKey
          ? new OpenAiTranscriber(config.openaiApiKey, config.openaiTranscribeModel)
          : new NoTranscriber(),
    },
  ],
  exports: [TranscriptionsService],
})
export class TranscriptionsModule {}
