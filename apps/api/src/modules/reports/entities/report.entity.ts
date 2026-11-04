import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { REPORT_STATUSES, REPORT_TYPES, type ReportStatus, type ReportType } from '@streetwise/shared';
import { Area } from '../../areas/entities/area.entity';
import { User } from '../../users/entities/user.entity';

@Index('IDX_reports_status_expiresAt', ['status', 'expiresAt'])
@Index('IDX_reports_lat_lng', ['lat', 'lng'])
@Index('IDX_reports_reporterId', ['reporterId'])
@Index('IDX_reports_areaId_capturedAt', ['areaId', 'capturedAt'])
@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter?: User;

  @Column({ type: 'enum', enum: REPORT_TYPES, enumName: 'report_type_enum' })
  type: ReportType;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'varchar', length: 140, nullable: true })
  note: string | null;

  /** Raw speech text (may name people or plates); only ever returned to the reporter. */
  @Column({ type: 'text', nullable: true })
  transcript: string | null;

  /** Redacted public one-liner. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  summary: string | null;

  @Column({ type: 'smallint', default: 2 })
  severity: number;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'uuid', nullable: true })
  areaId: string | null;

  @ManyToOne(() => Area, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'areaId' })
  area?: Area;

  @Column({ type: 'varchar', length: 120, nullable: true })
  locationName: string | null;

  /** Direction of travel when pinned, 0–359. */
  @Column({ type: 'smallint', nullable: true })
  heading: number | null;

  /** When the driver saw it (pins can be captured offline and posted later); drives time-of-day stats. */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  capturedAt: Date;

  @Column({ type: 'enum', enum: REPORT_STATUSES, enumName: 'report_status_enum', default: 'live' })
  status: ReportStatus;

  /** Null while a draft. */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'int', default: 0 })
  stillThereCount: number;

  @Column({ type: 'int', default: 0 })
  goneCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
