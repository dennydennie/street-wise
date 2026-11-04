import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** A WebAuthn credential registered through `POST /auth/passkeys/registration/*`. */
@Index('IDX_passkeys_userId', ['userId'])
@Entity('passkeys')
export class Passkey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  /** base64url credential id from the authenticator. */
  @Column({ type: 'varchar', length: 512, unique: true })
  credentialId: string;

  /** COSE public key, base64url. */
  @Column({ type: 'text' })
  publicKey: string;

  @Column({ type: 'bigint', default: 0 })
  signCount: string;

  /** Authenticator transports reported at registration (internal, hybrid, …), passed back in allowCredentials. */
  @Column({ type: 'varchar', length: 16, array: true, nullable: true })
  transports: string[] | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
