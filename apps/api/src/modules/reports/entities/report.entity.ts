import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { REPORT_STATUSES, REPORT_TYPES, type ReportStatus, type ReportType } from '@streetwise/shared';
import { User } from '../../users/entities/user.entity';

@Index('IDX_reports_status_expiresAt', ['status', 'expiresAt'])
@Index('IDX_reports_lat_lng', ['lat', 'lng'])
@Index('IDX_reports_reporterId', ['reporterId'])
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
