import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { REPORT_FLAG_REASONS, type ReportFlagReason } from '@streetwise/shared';
import { User } from '../../users/entities/user.entity';
import { Report } from './report.entity';

@Unique('UQ_report_flags_reportId_flaggerId', ['reportId', 'flaggerId'])
@Index('IDX_report_flags_flaggerId', ['flaggerId'])
@Entity('report_flags')
export class ReportFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reportId: string;

  @ManyToOne(() => Report, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportId' })
  report?: Report;

  @Column({ type: 'uuid' })
  flaggerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flaggerId' })
  flagger?: User;

  @Column({ type: 'enum', enum: REPORT_FLAG_REASONS, enumName: 'report_flag_reason_enum' })
  reason: ReportFlagReason;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
