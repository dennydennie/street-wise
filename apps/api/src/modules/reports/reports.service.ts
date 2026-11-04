import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import {
  REPORT_CAPTURED_AT_MAX_AGE_DAYS,
  type MyReport,
  type Report as ReportResponse,
  type ReportAnalysis,
} from '@streetwise/shared';
import { AreasService } from '../areas/areas.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { toPublicSummary } from './analysis/redact';
import { REPORT_ANALYZER, type ReportAnalyzer } from './analysis/report-analyzer';
import { severityFor } from './analysis/rule-based-report-analyzer';
import { CreateReportDto, FlagDto, UpdateReportDto } from './dto/reports.dto';
import { ModerationLogEntry } from './entities/moderation-log.entity';
import { ReportFlag } from './entities/report-flag.entity';
import { ReportVote } from './entities/report-vote.entity';
import { Report } from './entities/report.entity';
import { UserBlock } from './entities/user-block.entity';
import { toReportResponse } from './report.mapper';
import { applyVote, isOnMap, myReportStatus, reportExpiry, shouldSendToReview } from './report-rules';

export { toReportResponse } from './report.mapper';

const MAX_REPORTS_PER_BBOX = 500;
/** Phones and servers disagree by a little; a capturedAt this far ahead is still "now". */
const CLOCK_SKEW_MS = 2 * 60_000;
const DAY_MS = 86_400_000;

/** Validates an offline capture time: not in the future, at most 7 days old. */
export const resolveCapturedAt = (value: string | undefined, now: Date): Date => {
  if (!value) return now;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) throw new BadRequestException('capturedAt must be an ISO 8601 date');
  if (at.getTime() > now.getTime() + CLOCK_SKEW_MS) throw new BadRequestException('capturedAt cannot be in the future');
  if (at.getTime() < now.getTime() - REPORT_CAPTURED_AT_MAX_AGE_DAYS * DAY_MS) {
    throw new BadRequestException(`capturedAt must be within the last ${REPORT_CAPTURED_AT_MAX_AGE_DAYS} days`);
  }
  return at.getTime() > now.getTime() ? now : at;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserBlock) private readonly blocks: Repository<UserBlock>,
    @Inject(REPORT_ANALYZER) private readonly analyzer: ReportAnalyzer,
    private readonly areas: AreasService,
    private readonly notifications: NotificationsService,
  ) {}

  /** "Heard: … → Pothole" preview before posting. */
  async analyze(transcript: string): Promise<ReportAnalysis> {
    return this.analyzer.analyze(transcript.trim());
  }

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
    const capturedAt = resolveCapturedAt(body.capturedAt, now);
    const transcript = body.transcript?.trim() || null;
    const analysis = transcript ? await this.analyzer.analyze(transcript) : null;
    const type = body.type ?? analysis?.type ?? null;
    if (!type) {
      throw new UnprocessableEntityException({
        code: 'REPORT_TYPE_UNKNOWN',
        message: "Couldn't tell what kind of hazard that is. Pick a type and try again.",
        analysis,
      });
    }
    const note = body.note?.trim() || null;
    const draft = body.draft === true;
    const area = draft ? null : await this.areas.assign({ lat: body.lat, lng: body.lng });
    const report = await this.reports.save(
      this.reports.create({
        reporterId: userId,
        type,
        lat: body.lat,
        lng: body.lng,
        note,
        transcript,
        summary: analysis?.summary || (note ? toPublicSummary(note).summary : null),
        severity: analysis && analysis.type === type ? analysis.severity : severityFor(type, 0),
        tags: analysis?.tags ?? [],
        heading: body.heading ?? null,
        capturedAt,
        areaId: area?.id ?? null,
        locationName: area?.name ?? null,
        status: draft ? 'draft' : 'live',
        expiresAt: draft ? null : reportExpiry(type, capturedAt),
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
    const moved = body.lat !== undefined || body.lng !== undefined;
    if (body.publish && report.status === 'draft') {
      await this.assertAgreedToRules(userId);
      report.status = 'live';
      report.expiresAt = reportExpiry(report.type, now);
    }
    if (report.status !== 'draft' && (moved || !report.areaId)) {
      const area = await this.areas.assign({ lat: report.lat, lng: report.lng });
      report.areaId = area.id;
      report.locationName = area.name;
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
    let alert: Parameters<NotificationsService['moderationAlert']>[0] | null = null;
    const result = await this.dataSource.transaction(async (manager) => {
      const report = await this.lockReport(manager, reportId);
      if (report.reporterId === userId) throw new ForbiddenException('You cannot flag your own report');

      await manager.getRepository(ReportFlag).upsert({ reportId, flaggerId: userId, reason: body.reason }, { conflictPaths: ['reportId', 'flaggerId'] });
      const log = manager.getRepository(ModerationLogEntry);
      await log.insert({ reportId, reportType: report.type, action: 'flagged', reason: body.reason });

      const distinctFlags = await manager.getRepository(ReportFlag).count({ where: { reportId } });
      if (report.status === 'live' && shouldSendToReview(body.reason, distinctFlags)) {
        await manager.getRepository(Report).update({ id: reportId }, { status: 'review' });
        await log.insert({ reportId, reportType: report.type, action: 'sent_to_review', reason: body.reason });
        alert = { reportId, type: report.type, summary: report.summary, locationName: report.locationName, reason: body.reason, flags: distinctFlags };
      }

      if (body.blockReporter) {
        await manager.getRepository(UserBlock).upsert({ blockerId: userId, blockedId: report.reporterId }, { conflictPaths: ['blockerId', 'blockedId'] });
      }
      return { status: 'received' as const, blocked: body.blockReporter === true };
    });
    if (alert) await this.notifications.moderationAlert(alert);
    return result;
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
