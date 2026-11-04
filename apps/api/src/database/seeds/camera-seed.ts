import { DataSource, IsNull, Not } from 'typeorm';
import { Area } from '../../modules/areas/entities/area.entity';
import { AreasService } from '../../modules/areas/areas.service';
import { Camera } from '../../modules/cameras/entities/camera.entity';
import { NoReverseGeocoder } from '../../modules/geo/reverse-geocoder';
import { Report } from '../../modules/reports/entities/report.entity';
import { HARARE_CBD_CAMERAS } from './harare-cameras';

/** Each camera intersection gets an area with a fixed id derived from the camera's. */
export const cameraAreaId = (cameraId: string): string => cameraId.replace(/^5e0c/, 'a7ea');

/**
 * Idempotent: upserts the cameras and one area per camera, then puts every
 * non-draft report that has no area yet into one (the backfill for reports
 * created before areas existed).
 */
export const seedCamerasAndAreas = async (dataSource: DataSource): Promise<{ cameras: number; areas: number; backfilled: number }> => {
  await dataSource
    .getRepository(Camera)
    .upsert(HARARE_CBD_CAMERAS.map((camera) => ({ ...camera, source: 'official' as const, active: true })), ['id']);
  await dataSource
    .getRepository(Area)
    .upsert(HARARE_CBD_CAMERAS.map((camera) => ({ id: cameraAreaId(camera.id), name: camera.name, lat: camera.lat, lng: camera.lng })), ['id']);

  const areas = new AreasService(dataSource, new NoReverseGeocoder());
  const reports = dataSource.getRepository(Report);
  const orphans = await reports.find({ where: { areaId: IsNull(), status: Not('draft') }, select: { id: true, lat: true, lng: true } });
  for (const report of orphans) {
    const area = await areas.assign({ lat: report.lat, lng: report.lng });
    await reports.update({ id: report.id }, { areaId: area.id, locationName: area.name });
  }
  return { cameras: HARARE_CBD_CAMERAS.length, areas: HARARE_CBD_CAMERAS.length, backfilled: orphans.length };
};
