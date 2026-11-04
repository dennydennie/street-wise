import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { Camera } from '../cameras/entities/camera.entity';
import { Report } from '../reports/entities/report.entity';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { BRIEFING_WRITER, BriefingWriter, TemplateBriefingWriter } from './briefing-writer';
import { BriefingsService } from './briefings.service';
import { ClaudeBriefingWriter } from './claude-briefing-writer';
import { Area } from './entities/area.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Area, Report, Camera])],
  controllers: [AreasController],
  providers: [
    AreasService,
    BriefingsService,
    {
      provide: BRIEFING_WRITER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): BriefingWriter =>
        config.briefingWriter === 'claude' && config.anthropicApiKey
          ? new ClaudeBriefingWriter(config.anthropicApiKey, config.anthropicModel)
          : new TemplateBriefingWriter(),
    },
  ],
  exports: [AreasService],
})
export class AreasModule {}
