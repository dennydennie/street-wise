import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, Repository } from 'typeorm';
import { findPass, PASS_CATALOGUE, type MyPass, type PassId } from '@streetwise/shared';
import { User } from '../users/entities/user.entity';
import { UserPass } from './entities/user-pass.entity';
import { nextPassWindow } from './pass-window';

@Injectable()
export class PassesService {
  constructor(@InjectRepository(UserPass) private readonly passes: Repository<UserPass>) {}

  catalogue() {
    return PASS_CATALOGUE;
  }

  async myPass(userId: string, now = new Date()): Promise<MyPass> {
    const latest = await this.passes.findOne({ where: { userId, endsAt: MoreThan(now) }, order: { endsAt: 'DESC' } });
    return { active: latest !== null, passId: latest?.passId ?? null, endsAt: latest?.endsAt.toISOString() ?? null };
  }

  /**
   * Grants a paid pass inside the caller's transaction. Must only be called
   * from the verified Paynow result handler. Idempotent per payment.
   */
  async grantForPayment(
    manager: EntityManager,
    grant: { userId: string; passId: PassId; paymentId: string },
    now: Date,
  ): Promise<UserPass> {
    const repo = manager.getRepository(UserPass);
    const already = await repo.findOne({ where: { paymentId: grant.paymentId } });
    if (already) return already;

    const pass = findPass(grant.passId);
    if (!pass) throw new NotFoundException(`Unknown pass ${grant.passId}`);

    // Serialise grants per user so two callbacks cannot stack onto the same end date.
    await manager.getRepository(User).findOne({ where: { id: grant.userId }, lock: { mode: 'pessimistic_write' } });
    const current = await repo.findOne({ where: { userId: grant.userId }, order: { endsAt: 'DESC' } });
    const window = nextPassWindow(current?.endsAt ?? null, pass.durationDays, now);
    return repo.save(repo.create({ ...grant, ...window }));
  }
}
