import dataSource from '../../data-source';
import { Camera } from '../../modules/cameras/entities/camera.entity';
import { HARARE_CBD_CAMERAS } from './harare-cameras';

/** Idempotent: upserts the Harare CBD camera list by fixed id. Run after migrations. */
const run = async (): Promise<void> => {
  await dataSource.initialize();
  try {
    await dataSource
      .getRepository(Camera)
      .upsert(HARARE_CBD_CAMERAS.map((camera) => ({ ...camera, source: 'official' as const, active: true })), ['id']);
    console.log(`Seeded ${HARARE_CBD_CAMERAS.length} Harare CBD cameras`);
  } finally {
    await dataSource.destroy();
  }
};

run().catch((error) => {
  console.error('Camera seed failed', error);
  process.exit(1);
});
