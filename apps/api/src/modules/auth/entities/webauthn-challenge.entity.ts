import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const WEBAUTHN_CHALLENGE_KINDS = ['registration', 'authentication'] as const;
export type WebauthnChallengeKind = (typeof WEBAUTHN_CHALLENGE_KINDS)[number];

/** A WebAuthn ceremony challenge: valid for 5 minutes and consumed by the first verify attempt. */
@Index('IDX_webauthn_challenges_expiresAt', ['expiresAt'])
@Entity('webauthn_challenges')
export class WebauthnChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Set for registration (the signed-in user) and for authentication started with a known phone. */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 16 })
  kind: WebauthnChallengeKind;

  /** base64url challenge as sent in the options. */
  @Column({ type: 'varchar', length: 128 })
  challenge: string;

  /** Registration only: the label asked for when the options were created. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  label: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
