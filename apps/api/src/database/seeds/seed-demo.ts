import dataSource from '../../data-source';
import { Area } from '../../modules/areas/entities/area.entity';
import { Report } from '../../modules/reports/entities/report.entity';
import { User } from '../../modules/users/entities/user.entity';
import { seedCamerasAndAreas } from './camera-seed';
import { buildDemoHistory, DEMO_AREAS, DEMO_REPORTER_PHONE } from './demo-history';

/**
 * Idempotent demo data (`pnpm db:seed:demo`, never in production): a demo
 * reporter and a fresh 90-day history around Harare CBD. Re-running replaces
 * the demo reporter's reports, so the history always ends "now".
 */
const run = async (): Promise<void> => {
  await dataSource.initialize();
  try {
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production');
    await seedCamerasAndAreas(dataSource);
    await dataSource.getRepository(Area).upsert(Object.values(DEMO_AREAS).map((area) => ({ ...area })), ['id']);

    const users = dataSource.getRepository(User);
    await users.upsert(
      { phone: DEMO_REPORTER_PHONE, displayName: 'Demo reporter', agreedToRulesAt: new Date('2026-01-01T00:00:00Z') },
      ['phone'],
    );
    const reporter = await users.findOneByOrFail({ phone: DEMO_REPORTER_PHONE });

    const history = buildDemoHistory(new Date());
    await dataSource.transaction(async (manager) => {
      await manager.getRepository(Report).delete({ reporterId: reporter.id });
      await manager.getRepository(Report).insert(
        history.map((report) => ({ ...report, reporterId: reporter.id, note: null, transcript: null, heading: null, createdAt: report.capturedAt })),
      );
    });
    const live = history.filter((report) => report.status === 'live' && report.expiresAt.getTime() > Date.now()).length;
    console.log(`Seeded demo reporter ${DEMO_REPORTER_PHONE} with ${history.length} reports (${live} live) in ${Object.keys(DEMO_AREAS).length + 1} areas`);
  } finally {
    await dataSource.destroy();
  }
};

run().catch((error) => {
  console.error('Demo seed failed', error);
  process.exit(1);
});
