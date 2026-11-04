import { ForbiddenException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { User } from '../users/entities/user.entity';
import type { Report } from './entities/report.entity';
import type { UserBlock } from './entities/user-block.entity';
import { ReportsService } from './reports.service';

const userId = '11111111-1111-4111-8111-111111111111';

const build = (agreedToRulesAt: Date | null) => {
  const users = { findOne: jest.fn().mockResolvedValue({ id: userId, agreedToRulesAt }) };
  const reports = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'r1', stillThereCount: 0, goneCount: 0, createdAt: new Date(), ...value })),
  };
  const service = new ReportsService(
    {} as DataSource,
    reports as unknown as Repository<Report>,
    users as unknown as Repository<User>,
    {} as Repository<UserBlock>,
  );
  return { service, reports };
};

describe('ReportsService.create', () => {
  const body = { type: 'pothole' as const, lat: -17.83, lng: 31.05 };

  it('refuses to post before the user agreed to the community rules', async () => {
    const { service, reports } = build(null);
    await expect(service.create(userId, body)).rejects.toBeInstanceOf(ForbiddenException);
    expect(reports.save).not.toHaveBeenCalled();
  });

  it('refuses a draft pin too', async () => {
    const { service } = build(null);
    await expect(service.create(userId, { ...body, draft: true })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('posts a live report with an expiry once rules are accepted', async () => {
    const { service } = build(new Date('2026-11-01T00:00:00Z'));
    const report = await service.create(userId, body, new Date('2026-11-04T08:00:00Z'));
    expect(report.status).toBe('live');
    expect(report.expiresAt).toBe('2026-12-04T08:00:00.000Z');
    expect(report.isMine).toBe(true);
  });

  it('saves a quick pin as a draft without expiry', async () => {
    const { service } = build(new Date('2026-11-01T00:00:00Z'));
    const report = await service.create(userId, { ...body, draft: true });
    expect(report.status).toBe('draft');
    expect(report.expiresAt).toBeNull();
  });
});
