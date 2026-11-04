import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PASS_IDS, PAYMENT_METHODS, PAYMENT_STATUSES, type PassId, type PaymentMethod, type PaymentStatus } from '@streetwise/shared';
import { User } from '../../users/entities/user.entity';

/**
 * A Paynow payment for a pass. On account deletion the row is kept for
 * bookkeeping but detached: `userId` and `payerPhone` become null.
 */
@Index('IDX_payments_userId_createdAt', ['userId', 'createdAt'])
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16, unique: true })
  reference: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'enum', enum: PASS_IDS, enumName: 'pass_id_enum' })
  passId: PassId;

  @Column({ type: 'enum', enum: PAYMENT_METHODS, enumName: 'payment_method_enum' })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PAYMENT_STATUSES, enumName: 'payment_status_enum', default: 'created' })
  status: PaymentStatus;

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: 'USD';

  @Column({ type: 'varchar', length: 20, nullable: true })
  payerPhone: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  paynowReference: string | null;

  @Column({ type: 'text', nullable: true })
  pollUrl: string | null;

  @Column({ type: 'text', nullable: true })
  redirectUrl: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  /** Why the payment failed or was cancelled, shown to the payer. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  failureReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
