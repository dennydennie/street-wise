import { Inject, Injectable } from '@nestjs/common';
import { AREA_RADIUS_M } from '@streetwise/shared';
import { Between, DataSource, EntityManager } from 'typeorm';
import { Camera } from '../cameras/entities/camera.entity';
import { boundingBox, LatLng, nearestWithin } from '../geo/haversine';
import { REVERSE_GEOCODER, type ReverseGeocoder } from '../geo/reverse-geocoder';
import { Area } from './entities/area.entity';

/** A new area takes a camera's name when the camera is this close. */
export const CAMERA_NAME_RADIUS_M = 300;
/** Serialises area creation so two reports at the same spot cannot create two areas. */
const AREA_CREATE_LOCK = 7_301_001;

export const fallbackAreaName = (point: LatLng): string => `Near ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;

@Injectable()
export class AreasService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REVERSE_GEOCODER) private readonly geocoder: ReverseGeocoder,
  ) {}

  /** The nearest area within 200 m of the point, or a new one named after the place. */
  async assign(point: LatLng): Promise<Area> {
    const existing = await this.findNearest(this.dataSource.manager, point);
    if (existing) return existing;

    // Naming may call an external geocoder: do it before taking the lock.
    const name = await this.nameFor(point);
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [AREA_CREATE_LOCK]);
      const raced = await this.findNearest(manager, point);
      if (raced) return raced;
      const repo = manager.getRepository(Area);
      return repo.save(repo.create({ name, lat: point.lat, lng: point.lng }));
    });
  }

  async findNearest(manager: EntityManager, point: LatLng, radiusM = AREA_RADIUS_M): Promise<Area | null> {
    const box = boundingBox(point, radiusM);
    const candidates = await manager.getRepository(Area).find({
      where: { lat: Between(box.minLat, box.maxLat), lng: Between(box.minLng, box.maxLng) },
    });
    return nearestWithin(point, candidates, radiusM)?.item ?? null;
  }

  /** Reverse geocoder → nearest camera within 300 m → "Near <lat>, <lng>". */
  async nameFor(point: LatLng): Promise<string> {
    const geocoded = await this.geocoder.nameFor(point).catch(() => null);
    if (geocoded) return geocoded;
    const box = boundingBox(point, CAMERA_NAME_RADIUS_M);
    const cameras = await this.dataSource.manager.getRepository(Camera).find({
      where: { active: true, lat: Between(box.minLat, box.maxLat), lng: Between(box.minLng, box.maxLng) },
    });
    return nearestWithin(point, cameras, CAMERA_NAME_RADIUS_M)?.item.name ?? fallbackAreaName(point);
  }
}
