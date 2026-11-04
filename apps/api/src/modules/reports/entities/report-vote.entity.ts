import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { REPORT_VOTES, type ReportVote as ReportVoteValue } from '@streetwise/shared';
import { User } from '../../users/entities/user.entity';
import { Report } from './report.entity';

/** One vote per user per report; voting again changes it. */
@Unique('UQ_report_votes_reportId_voterId', ['reportId', 'voterId'])
@Index('IDX_report_votes_voterId', ['voterId'])
@Entity('report_votes')
export class ReportVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reportId: string;

  @ManyToOne(() => Report, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportId' })
  report?: Report;

  @Column({ type: 'uuid' })
  voterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'voterId' })
  voter?: User;

  @Column({ type: 'enum', enum: REPORT_VOTES, enumName: 'report_vote_enum' })
  vote: ReportVoteValue;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
