import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BRIEFING_DEFAULT_LIMIT,
  BRIEFING_DEFAULT_RADIUS_M,
  BRIEFING_HISTORY_DAYS,
  type AreaBriefing,
  type AreaDetail,
  type BriefingResponse,
  type TimeBand,
} from '@streetwise/shared';
import { Between, Brackets, Repository } from 'typeorm';
import { boundingBox, haversineMeters } from '../geo/haversine';
import { Report } from '../reports/entities/report.entity';
import { toReportResponse } from '../reports/report.mapper';
import { type AreaStats, compareBriefings, computeAreaStats, toBriefingItem } from './briefing-engine';
import { BRIEFING_WRITER, type BriefingWriter } from './briefing-writer';
import { BriefingsQuery } from './dto/briefings.dto';
import { Area } from './entities/area.entity';
import { timeBandAt } from './time-bands';

const DAY_MS = 86_400_000;
const RECENT_REPORTS = 20;

type Scored = { area: Area; distanceM: number; stats: AreaStats };

@Injectable()
export class BriefingsService {
  constructor(
    @InjectRepository(Area) private readonly areas: Repository<Area>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @Inject(BRIEFING_WRITER) private readonly writer: BriefingWriter,
  ) {}

  /**
   * Areas around a point, most urgent first. `at` only chooses the time-of-day
   * band; what is live and how old a report is are measured from `now`.
   */
  async briefings(query: BriefingsQuery, viewerId: string | undefined, now = new Date()): Promise<BriefingResponse> {
    const at = query.at ? new Date(query.at) : now;
    const band = timeBandAt(at);
    const centre = { lat: query.lat, lng: query.lng };
    const radiusM = query.radiusM ?? BRIEFING_DEFAULT_RADIUS_M;
    const box = boundingBox(centre, radiusM);

    const nearby = (
      await this.areas.find({ where: { lat: Between(box.minLat, box.maxLat), lng: Between(box.minLng, box.maxLng) } })
    )
      .map((area) => ({ area, distanceM: haversineMeters(centre, area) }))
      .filter((entry) => entry.distanceM <= radiusM);

    const byArea = await this.historyFor(nearby.map((entry) => entry.area.id), viewerId, now);
    const scored: Scored[] = [];
    for (const entry of nearby) {
      const reports = byArea.get(entry.area.id);
      if (!reports?.length) continue;
      scored.push({ ...entry, stats: computeAreaStats(reports, band, now) });
    }
    scored.sort((a, b) =>
      compareBriefings({ ...a.stats, distanceM: a.distanceM }, { ...b.stats, distanceM: b.distanceM }),
    );

    const top = scored.slice(0, query.limit ?? BRIEFING_DEFAULT_LIMIT);
    return {
      generatedAt: now.toISOString(),
      at: at.toISOString(),
      timeBand: band,
      areas: await Promise.all(top.map((entry) => this.toAreaBriefing(entry, band))),
    };
  }

  async area(areaId: string, atIso: string | undefined, viewerId: string | undefined, now = new Date()): Promise<AreaDetail> {
    const area = await this.areas.findOne({ where: { id: areaId } });
    if (!area) throw new NotFoundException('Area not found');
    const band = timeBandAt(atIso ? new Date(atIso) : now);
    const history = (await this.historyFor([area.id], viewerId, now)).get(area.id) ?? [];
    const briefing = await this.toAreaBriefing({ area, distanceM: 0, stats: computeAreaStats(history, band, now) }, band);

    const recentQuery = this.reports
      .createQueryBuilder('r')
      .where('r."areaId" = :areaId', { areaId })
      .andWhere('r.status IN (:...statuses)', { statuses: ['live', 'gone'] })
      .orderBy('r."capturedAt"', 'DESC')
      .limit(RECENT_REPORTS);
    this.excludeBlocked(recentQuery, viewerId);
    const recent = await recentQuery.getMany();
    return { ...briefing, recent: recent.map((row) => toReportResponse(row, viewerId)) };
  }

  /** Reports in the history window (every status but draft/removed), grouped by area. */
  private async historyFor(areaIds: string[], viewerId: string | undefined, now: Date): Promise<Map<string, Report[]>> {
    const grouped = new Map<string, Report[]>();
    if (areaIds.length === 0) return grouped;
    const query = this.reports
      .createQueryBuilder('r')
      .select(['r.id', 'r.areaId', 'r.type', 'r.status', 'r.capturedAt', 'r.expiresAt', 'r.stillThereCount', 'r.tags'])
      .where('r."areaId" IN (:...areaIds)', { areaIds })
      .andWhere('r.status NOT IN (:...hidden)', { hidden: ['draft', 'removed'] })
      .andWhere('r."capturedAt" >= :since', { since: new Date(now.getTime() - BRIEFING_HISTORY_DAYS * DAY_MS) });
    this.excludeBlocked(query, viewerId);
    for (const row of await query.getMany()) {
      const list = grouped.get(row.areaId as string) ?? [];
      list.push(row);
      grouped.set(row.areaId as string, list);
    }
    return grouped;
  }

  private excludeBlocked(query: ReturnType<Repository<Report>['createQueryBuilder']>, viewerId: string | undefined) {
    if (!viewerId) return;
    query.andWhere(
      new Brackets((qb) =>
        qb.where('NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b."blockerId" = :viewerId AND b."blockedId" = r."reporterId")', {
          viewerId,
        }),
      ),
    );
  }

  private async toAreaBriefing({ area, distanceM, stats }: Scored, band: TimeBand): Promise<AreaBriefing> {
    const text = await this.writer.write({ areaId: area.id, areaName: area.name, timeBand: band, items: stats.items });
    return {
      areaId: area.id,
      name: area.name,
      lat: area.lat,
      lng: area.lng,
      distanceM: Math.round(distanceM),
      priority: stats.priority,
      score: stats.score,
      alert: stats.alert,
      headline: text.headline,
      advice: text.advice,
      items: stats.items.map(toBriefingItem),
      hourly: stats.hourly,
    };
  }
}
