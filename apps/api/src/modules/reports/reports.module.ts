import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ModerationLogEntry } from './entities/moderation-log.entity';
import { ReportFlag } from './entities/report-flag.entity';
import { ReportVote } from './entities/report-vote.entity';
import { Report } from './entities/report.entity';
import { UserBlock } from './entities/user-block.entity';
import { MyReportsController, ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Report, ReportVote, ReportFlag, UserBlock, ModerationLogEntry, User])],
  controllers: [ReportsController, MyReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
