import dataSource from '../../data-source';
import { seedCamerasAndAreas } from './camera-seed';

/** Idempotent: upserts the Harare CBD cameras and their areas, and backfills report areas. Run after migrations. */
const run = async (): Promise<void> => {
  await dataSource.initialize();
  try {
    const result = await seedCamerasAndAreas(dataSource);
    console.log(`Seeded ${result.cameras} Harare CBD cameras and ${result.areas} camera areas; backfilled ${result.backfilled} report(s)`);
  } finally {
    await dataSource.destroy();
  }
};

run().catch((error) => {
  console.error('Camera seed failed', error);
  process.exit(1);
});
