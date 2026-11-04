import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CAMERA_CHECKS, CAMERA_SOURCES, type CameraCheck, type CameraSource } from '@streetwise/shared';

/** A traffic-camera "robot". Public data, served without auth. */
@Index('IDX_cameras_updatedAt', ['updatedAt'])
@Entity('cameras')
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'enum', enum: CAMERA_CHECKS, enumName: 'camera_check_enum', array: true, default: '{}' })
  checks: CameraCheck[];

  @Column({ type: 'enum', enum: CAMERA_SOURCES, enumName: 'camera_source_enum', default: 'official' })
  source: CameraSource;

  /** 0..1, how sure we are the camera is there and enforcing. */
  @Column({ type: 'real', default: 1 })
  confidence: number;

  /** Inactive cameras are still returned by `?since=` so clients can drop them. */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
