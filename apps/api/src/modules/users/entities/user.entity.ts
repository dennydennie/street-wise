import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** E.164 (+263…). Removed with the account. */
  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  displayName: string | null;

  /** When the user accepted the community reporting rules (Play UGC policy). Required before posting. */
  @Column({ type: 'timestamptz', nullable: true })
  agreedToRulesAt: Date | null;

  /** Whether an SMS code may sign this account in. Counts as a sign-in method. */
  @Column({ type: 'boolean', default: true })
  phoneSignInEnabled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
