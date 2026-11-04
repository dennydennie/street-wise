import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** The blocker no longer sees reports from the blocked user. */
@Unique('UQ_user_blocks_blockerId_blockedId', ['blockerId', 'blockedId'])
@Entity('user_blocks')
export class UserBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  blockerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blockerId' })
  blocker?: User;

  @Column({ type: 'uuid' })
  blockedId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blockedId' })
  blocked?: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
