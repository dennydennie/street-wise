import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import type { CameraListResponse } from '@streetwise/shared';
import { Camera } from './entities/camera.entity';

@Injectable()
export class CamerasService {
  constructor(@InjectRepository(Camera) private readonly cameras: Repository<Camera>) {}

  /** Full list of active cameras, or every change (including deactivations) since `since`. */
  async list(since?: Date): Promise<CameraListResponse> {
    const serverTime = new Date();
    const rows = await this.cameras.find({
      where: since ? { updatedAt: MoreThan(since) } : { active: true },
      order: { name: 'ASC' },
    });
    return {
      serverTime: serverTime.toISOString(),
      cameras: rows.map((c) => ({
        id: c.id,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        checks: c.checks,
        source: c.source,
        confidence: c.confidence,
        active: c.active,
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  }
}
