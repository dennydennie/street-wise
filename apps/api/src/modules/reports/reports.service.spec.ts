import { BadRequestException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { AreasService } from '../areas/areas.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { User } from '../users/entities/user.entity';
import { RuleBasedReportAnalyzer } from './analysis/rule-based-report-analyzer';
import type { Report } from './entities/report.entity';
import type { UserBlock } from './entities/user-block.entity';
import { ReportsService, resolveCapturedAt } from './reports.service';

const userId = '11111111-1111-4111-8111-111111111111';
const AREA = { id: '22222222-2222-4222-8222-222222222222', name: 'Seke Rd × Cripps Rd', lat: -17.8447, lng: 31.0342 };

const build = (agreedToRulesAt: Date | null) => {
  const users = { findOne: jest.fn().mockResolvedValue({ id: userId, agreedToRulesAt }) };
  const reports = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'r1', stillThereCount: 0, goneCount: 0, createdAt: new Date(), reporterId: userId, ...value })),
  };
  const areas = { assign: jest.fn(async () => AREA) };
  const service = new ReportsService(
    {} as DataSource,
    reports as unknown as Repository<Report>,
    users as unknown as Repository<User>,
    {} as Repository<UserBlock>,
    new RuleBasedReportAnalyzer(),
    areas as unknown as AreasService,
    { moderationAlert: jest.fn() } as unknown as NotificationsService,
  );
  return { service, reports, areas };
};

describe('ReportsService.create', () => {
  const body = { type: 'pothole' as const, lat: -17.83, lng: 31.05 };
  const agreed = new Date('2026-11-01T00:00:00Z');

  it('refuses to post before the user agreed to the community rules', async () => {
    const { service, reports } = build(null);
    await expect(service.create(userId, body)).rejects.toBeInstanceOf(ForbiddenException);
    expect(reports.save).not.toHaveBeenCalled();
  });

  it('refuses a draft pin too', async () => {
    const { service } = build(null);
    await expect(service.create(userId, { ...body, draft: true })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('posts a live report with an expiry and an area once rules are accepted', async () => {
    const { service } = build(agreed);
    const report = await service.create(userId, body, new Date('2026-11-04T08:00:00Z'));
    expect(report.status).toBe('live');
    expect(report.expiresAt).toBe('2026-12-04T08:00:00.000Z');
    expect(report.isMine).toBe(true);
    expect(report.areaId).toBe(AREA.id);
    expect(report.locationName).toBe(AREA.name);
    expect(report.capturedAt).toBe('2026-11-04T08:00:00.000Z');
  });

  it('saves a quick pin as a draft without expiry or area', async () => {
    const { service, areas } = build(agreed);
    const report = await service.create(userId, { ...body, draft: true });
    expect(report.status).toBe('draft');
    expect(report.expiresAt).toBeNull();
    expect(areas.assign).not.toHaveBeenCalled();
  });

  it('infers the type from a transcript and publishes a redacted summary', async () => {
    const { service } = build(agreed);
    const report = await service.create(userId, {
      lat: -17.8447,
      lng: 31.0342,
      transcript: 'smash and grab at the lights, AEB 1234 drove off',
    });
    expect(report.type).toBe('crime_hotspot');
    expect(report.summary).toBe('Smash and grab at the lights, [plate] drove off');
    expect(report.tags).toContain('smash_and_grab');
    expect(report.transcript).toBe('smash and grab at the lights, AEB 1234 drove off');
  });

  it('answers 422 when the transcript says nothing it can classify and no type was given', async () => {
    const { service, reports } = build(agreed);
    await expect(service.create(userId, { lat: -17.83, lng: 31.05, transcript: 'hello there' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(reports.save).not.toHaveBeenCalled();
  });
});

describe('resolveCapturedAt', () => {
  const now = new Date('2026-11-04T08:00:00Z');
  it('defaults to now and accepts up to 7 days back', () => {
    expect(resolveCapturedAt(undefined, now)).toBe(now);
    expect(resolveCapturedAt('2026-10-29T08:00:00Z', now).toISOString()).toBe('2026-10-29T08:00:00.000Z');
  });
  it('rejects the future and anything older than 7 days', () => {
    expect(() => resolveCapturedAt('2026-11-04T09:00:00Z', now)).toThrow(BadRequestException);
    expect(() => resolveCapturedAt('2026-10-27T07:59:00Z', now)).toThrow(BadRequestException);
  });
});
