import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PASS_IDS, type PassId } from '@streetwise/shared';
import { User } from '../../users/entities/user.entity';

/** A granted Plus pass window. Granted only from a verified Paynow "paid" callback. */
@Index('IDX_user_passes_userId_endsAt', ['userId', 'endsAt'])
@Entity('user_passes')
export class UserPass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'enum', enum: PASS_IDS, enumName: 'pass_id_enum' })
  passId: PassId;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  /** One grant per payment: a replayed callback cannot grant twice. */
  @Column({ type: 'uuid', unique: true })
  paymentId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
