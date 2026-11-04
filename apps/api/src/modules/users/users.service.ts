import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import type { Session as SessionResponse, User as UserResponse } from '@streetwise/shared';
import { OtpChallenge } from '../auth/entities/otp-challenge.entity';
import { Passkey } from '../auth/entities/passkey.entity';
import { Session } from '../auth/entities/session.entity';
import { toPasskeyResponse } from '../auth/passkeys/passkeys.service';
import { UserPass } from '../passes/entities/user-pass.entity';
import { Payment } from '../payments/entities/payment.entity';
import { ReportFlag } from '../reports/entities/report-flag.entity';
import { ReportVote } from '../reports/entities/report-vote.entity';
import { Report } from '../reports/entities/report.entity';
import { UserBlock } from '../reports/entities/user-block.entity';
import { UpdateMeDto } from './dto/users.dto';
import { User } from './entities/user.entity';
import { toUserResponse } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
  ) {}

  async getMe(userId: string): Promise<UserResponse> {
    return toUserResponse(await this.findOrFail(userId));
  }

  async updateMe(userId: string, body: UpdateMeDto, now = new Date()): Promise<UserResponse> {
    const user = await this.findOrFail(userId);
    if (body.displayName !== undefined) user.displayName = body.displayName.trim();
    // Agreeing is recorded once, with the server's clock.
    if (body.agreedToRulesAt !== undefined && !user.agreedToRulesAt) user.agreedToRulesAt = now;
    return toUserResponse(await this.users.save(user));
  }

  /**
   * Real deletion. Cascades remove sessions, passkeys, reports (and the votes
   * and flags on them), the user's own votes, flags, blocks and passes.
   * Payments are kept for bookkeeping with the user and phone detached. The
   * moderation log holds no user data and is left as is.
   */
  async deleteMe(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      await manager.getRepository(OtpChallenge).delete({ phone: user.phone });
      await manager.getRepository(Payment).update({ userId }, { payerPhone: null, userId: null });
      await manager.getRepository(User).delete({ id: userId });
    });
  }

  /** Everything we hold about the user, as one JSON document. */
  async exportMe(userId: string, currentSessionId: string) {
    const user = await this.findOrFail(userId);
    const repo = <T extends object>(entity: new () => T) => this.dataSource.getRepository(entity);
    const [sessions, passkeys, reports, votes, flags, blocks, passes, payments] = await Promise.all([
      this.listSessions(userId, currentSessionId),
      repo(Passkey).find({ where: { userId } }),
      repo(Report).find({ where: { reporterId: userId }, order: { createdAt: 'DESC' } }),
      repo(ReportVote).find({ where: { voterId: userId } }),
      repo(ReportFlag).find({ where: { flaggerId: userId } }),
      repo(UserBlock).find({ where: { blockerId: userId } }),
      repo(UserPass).find({ where: { userId }, order: { startsAt: 'DESC' } }),
      repo(Payment).find({ where: { userId }, order: { createdAt: 'DESC' } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user: { ...toUserResponse(user), phoneSignInEnabled: user.phoneSignInEnabled },
      sessions,
      passkeys: passkeys.map(toPasskeyResponse),
      reports: reports.map((r) => ({
        id: r.id, type: r.type, lat: r.lat, lng: r.lng, note: r.note, status: r.status,
        createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt?.toISOString() ?? null,
      })),
      votes: votes.map((v) => ({ reportId: v.reportId, vote: v.vote, at: v.updatedAt.toISOString() })),
      flags: flags.map((f) => ({ reportId: f.reportId, reason: f.reason, at: f.createdAt.toISOString() })),
      blocks: blocks.map((b) => ({ id: b.id, createdAt: b.createdAt.toISOString() })),
      passes: passes.map((p) => ({ passId: p.passId, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString() })),
      payments: payments.map((p) => ({
        reference: p.reference, passId: p.passId, method: p.method, status: p.status,
        amountCents: p.amountCents, currency: p.currency, payerPhone: p.payerPhone,
        createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null,
      })),
    };
  }

  async listSessions(userId: string, currentSessionId: string): Promise<SessionResponse[]> {
    const rows = await this.sessions.find({ where: { userId, revokedAt: IsNull() }, order: { lastSeenAt: 'DESC' } });
    return rows.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  /** "Sign out other devices": revokes every session except the caller's. */
  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<{ revoked: number }> {
    const result = await this.sessions.update(
      { userId, id: Not(currentSessionId), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { revoked: result.affected ?? 0 };
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.sessions.update({ userId, id: sessionId, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!result.affected) throw new NotFoundException('Session not found');
  }

  private async findOrFail(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
