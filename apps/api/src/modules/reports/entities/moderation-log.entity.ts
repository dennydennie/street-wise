import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const MODERATION_ACTIONS = ['flagged', 'sent_to_review', 'hidden_by_votes', 'deleted_by_owner'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

/**
 * Anonymous moderation trail. Deliberately holds no user id, phone or note
 * text and no foreign keys, so it survives account deletion.
 */
@Index('IDX_moderation_log_reportId', ['reportId'])
@Entity('moderation_log')
export class ModerationLogEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** May point at a report that no longer exists. */
  @Column({ type: 'uuid', nullable: true })
  reportId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reportType: string | null;

  @Column({ type: 'varchar', length: 32 })
  action: ModerationAction;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
