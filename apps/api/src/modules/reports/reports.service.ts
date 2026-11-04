import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import type { MyReport, Report as ReportResponse } from '@streetwise/shared';
import { User } from '../users/entities/user.entity';
import { CreateReportDto, FlagDto, UpdateReportDto } from './dto/reports.dto';
import { ModerationLogEntry } from './entities/moderation-log.entity';
import { ReportFlag } from './entities/report-flag.entity';
import { ReportVote } from './entities/report-vote.entity';
import { Report } from './entities/report.entity';
import { UserBlock } from './entities/user-block.entity';
import { applyVote, isOnMap, myReportStatus, reportExpiry, shouldSendToReview } from './report-rules';

const MAX_REPORTS_PER_BBOX = 500;

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserBlock) private readonly blocks: Repository<UserBlock>,
  ) {}

  /** Live, unexpired reports in the box, minus those from reporters the viewer blocked. */
  async listInBbox(bbox: string, viewerId: string | undefined, now = new Date()): Promise<ReportResponse[]> {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
    if (minLng > maxLng || minLat > maxLat) throw new BadRequestException('bbox must be minLng,minLat,maxLng,maxLat');

    const query = this.reports
      .createQueryBuilder('r')
      .where('r.status = :status', { status: 'live' })
      .andWhere('r.expiresAt > :now', { now })
      .andWhere('r.lat BETWEEN :minLat AND :maxLat', { minLat, maxLat })
      .andWhere('r.lng BETWEEN :minLng AND :maxLng', { minLng, maxLng })
      .orderBy('r.createdAt', 'DESC')
      .limit(MAX_REPORTS_PER_BBOX);
    if (viewerId) {
      query.andWhere(
        new Brackets((qb) =>
          qb.where(
            'NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b."blockerId" = :viewerId AND b."blockedId" = r."reporterId")',
            { viewerId },
          ),
        ),
      );
    }
    const rows = await query.getMany();
    return rows.map((row) => toReportResponse(row, viewerId));
  }

  async create(userId: string, body: CreateReportDto, now = new Date()): Promise<ReportResponse> {
    await this.assertAgreedToRules(userId);
    const draft = body.draft === true;
    const report = await this.reports.save(
      this.reports.create({
        reporterId: userId,
        type: body.type,
        lat: body.lat,
        lng: body.lng,
        note: body.note?.trim() || null,
        status: draft ? 'draft' : 'live',
        expiresAt: draft ? null : reportExpiry(body.type, now),
      }),
    );
    return toReportResponse(report, userId);
  }

  async update(userId: string, reportId: string, body: UpdateReportDto, now = new Date()): Promise<ReportResponse> {
    const report = await this.findOwned(userId, reportId);
    if (body.type !== undefined) report.type = body.type;
    if (body.lat !== undefined) report.lat = body.lat;
    if (body.lng !== undefined) report.lng = body.lng;
    if (body.note !== undefined) report.note = body.note?.trim() || null;
    if (body.publish && report.status === 'draft') {
      await this.assertAgreedToRules(userId);
      report.status = 'live';
      report.expiresAt = reportExpiry(report.type, now);
    }
    return toReportResponse(await this.reports.save(report), userId);
  }

  async remove(userId: string, reportId: string): Promise<void> {
    const report = await this.findOwned(userId, reportId);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ModerationLogEntry).insert({ reportId: report.id, reportType: report.type, action: 'deleted_by_owner', reason: null });
      await manager.getRepository(Report).delete({ id: report.id });
    });
  }

  async vote(userId: string, reportId: string, vote: ReportVote['vote'], now = new Date()): Promise<ReportResponse> {
    return this.dataSource.transaction(async (manager) => {
      const report = await this.lockReport(manager, reportId);
      if (report.reporterId === userId) throw new ForbiddenException('You cannot vote on your own report');
      if (!isOnMap(report, now)) throw new ConflictException('This report is no longer live');

      await manager
        .getRepository(ReportVote)
        .upsert({ reportId, voterId: userId, vote, updatedAt: now }, { conflictPaths: ['reportId', 'voterId'] });
      const tally = await this.tally(manager, reportId);
      const next = applyVote(report, vote, tally, now);

      if (next.status === 'gone' && report.status !== 'gone') {
        await manager.getRepository(ModerationLogEntry).insert({ reportId, reportType: report.type, action: 'hidden_by_votes', reason: null });
      }
      Object.assign(report, next, { stillThereCount: tally.stillThere, goneCount: tally.gone });
      return toReportResponse(await manager.getRepository(Report).save(report), userId);
    });
  }

  async flag(userId: string, reportId: string, body: FlagDto): Promise<{ status: 'received'; blocked: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const report = await this.lockReport(manager, reportId);
      if (report.reporterId === userId) throw new ForbiddenException('You cannot flag your own report');

      await manager.getRepository(ReportFlag).upsert({ reportId, flaggerId: userId, reason: body.reason }, { conflictPaths: ['reportId', 'flaggerId'] });
      const log = manager.getRepository(ModerationLogEntry);
      await log.insert({ reportId, reportType: report.type, action: 'flagged', reason: body.reason });

      const distinctFlags = await manager.getRepository(ReportFlag).count({ where: { reportId } });
      if (report.status === 'live' && shouldSendToReview(body.reason, distinctFlags)) {
        await manager.getRepository(Report).update({ id: reportId }, { status: 'review' });
        await log.insert({ reportId, reportType: report.type, action: 'sent_to_review', reason: body.reason });
      }

      if (body.blockReporter) {
        await manager.getRepository(UserBlock).upsert({ blockerId: userId, blockedId: report.reporterId }, { conflictPaths: ['blockerId', 'blockedId'] });
      }
      return { status: 'received', blocked: body.blockReporter === true };
    });
  }

  async myReports(userId: string, now = new Date()): Promise<MyReport[]> {
    const rows = await this.reports.find({ where: { reporterId: userId }, order: { createdAt: 'DESC' } });
    return rows.map((row) => ({ ...toReportResponse(row, userId), status: myReportStatus(row, now) }));
  }

  /** Erases the user's reports only (votes and flags on them go with them). */
  async eraseMyReports(userId: string): Promise<{ deleted: number }> {
    const result = await this.reports.delete({ reporterId: userId });
    return { deleted: result.affected ?? 0 };
  }

  // ── Blocks ──────────────────────────────────────────
  async listBlocks(userId: string) {
    const rows = await this.blocks.find({ where: { blockerId: userId }, order: { createdAt: 'DESC' } });
    return rows.map((b) => ({ id: b.id, createdAt: b.createdAt.toISOString() }));
  }

  async blockReporterOf(userId: string, reportId: string) {
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.reporterId === userId) throw new BadRequestException('You cannot block yourself');
    await this.blocks.upsert({ blockerId: userId, blockedId: report.reporterId }, { conflictPaths: ['blockerId', 'blockedId'] });
    const block = await this.blocks.findOneByOrFail({ blockerId: userId, blockedId: report.reporterId });
    return { id: block.id, createdAt: block.createdAt.toISOString() };
  }

  async unblock(userId: string, blockId: string): Promise<void> {
    const result = await this.blocks.delete({ id: blockId, blockerId: userId });
    if (!result.affected) throw new NotFoundException('Block not found');
  }

  // ── helpers ────────────────────────────────────────
  /** Play UGC policy: nobody posts before accepting the community rules. */
  private async assertAgreedToRules(userId: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.agreedToRulesAt) {
      throw new ForbiddenException({ code: 'RULES_NOT_ACCEPTED', message: 'Accept the community rules before posting.' });
    }
  }

  private async findOwned(userId: string, reportId: string): Promise<Report> {
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.reporterId !== userId) throw new ForbiddenException('Only the reporter can change this report');
    return report;
  }

  private async lockReport(manager: EntityManager, reportId: string): Promise<Report> {
    const report = await manager.getRepository(Report).findOne({ where: { id: reportId }, lock: { mode: 'pessimistic_write' } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  private async tally(manager: EntityManager, reportId: string) {
    const rows = await manager
      .getRepository(ReportVote)
      .createQueryBuilder('v')
      .select('v.vote', 'vote')
      .addSelect('COUNT(DISTINCT v."voterId")', 'count')
      .where('v."reportId" = :reportId', { reportId })
      .groupBy('v.vote')
      .getRawMany<{ vote: string; count: string }>();
    const count = (vote: string) => Number(rows.find((r) => r.vote === vote)?.count ?? 0);
    return { stillThere: count('still_there'), gone: count('gone') };
  }
}

export const toReportResponse = (row: Report, viewerId?: string): ReportResponse => ({
  id: row.id,
  type: row.type,
  lat: row.lat,
  lng: row.lng,
  note: row.note,
  status: row.status,
  stillThereCount: row.stillThereCount,
  goneCount: row.goneCount,
  expiresAt: row.expiresAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  isMine: viewerId !== undefined && row.reporterId === viewerId,
});
