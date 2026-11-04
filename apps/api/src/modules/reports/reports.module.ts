import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { AreasModule } from '../areas/areas.module';
import { User } from '../users/entities/user.entity';
import { ClaudeReportAnalyzer } from './analysis/claude-report-analyzer';
import { REPORT_ANALYZER, ReportAnalyzer } from './analysis/report-analyzer';
import { RuleBasedReportAnalyzer } from './analysis/rule-based-report-analyzer';
import { ModerationLogEntry } from './entities/moderation-log.entity';
import { ReportFlag } from './entities/report-flag.entity';
import { ReportVote } from './entities/report-vote.entity';
import { Report } from './entities/report.entity';
import { UserBlock } from './entities/user-block.entity';
import { MyReportsController, ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Report, ReportVote, ReportFlag, UserBlock, ModerationLogEntry, User]), AreasModule],
  controllers: [ReportsController, MyReportsController],
  providers: [
    ReportsService,
    {
      provide: REPORT_ANALYZER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): ReportAnalyzer =>
        config.reportAnalyzer === 'claude' && config.anthropicApiKey
          ? new ClaudeReportAnalyzer(config.anthropicApiKey, config.anthropicModel)
          : new RuleBasedReportAnalyzer(),
    },
  ],
})
export class ReportsModule {}
