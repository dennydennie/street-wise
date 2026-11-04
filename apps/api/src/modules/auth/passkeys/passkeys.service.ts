import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Passkey as PasskeyResponse } from '@streetwise/shared';
import { User } from '../../users/entities/user.entity';
import { Passkey } from '../entities/passkey.entity';
import { assertCanRemoveSignInMethod } from '../sign-in-methods';

@Injectable()
export class PasskeysService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Passkey) private readonly passkeys: Repository<Passkey>,
  ) {}

  async list(userId: string): Promise<PasskeyResponse[]> {
    const rows = await this.passkeys.find({ where: { userId }, order: { createdAt: 'ASC' } });
    return rows.map(toPasskeyResponse);
  }

  async signInMethods(userId: string) {
    const user = await this.dataSource.getRepository(User).findOneByOrFail({ id: userId });
    return { phone: user.phoneSignInEnabled, passkeys: await this.passkeys.count({ where: { userId } }) };
  }

  async remove(userId: string, passkeyId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Lock the user row so two parallel removals cannot both pass the check.
      const user = await manager.getRepository(User).findOne({ where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      const passkey = await manager.getRepository(Passkey).findOne({ where: { id: passkeyId, userId } });
      if (!user || !passkey) throw new NotFoundException('Passkey not found');

      const passkeyCount = await manager.getRepository(Passkey).count({ where: { userId } });
      assertCanRemoveSignInMethod({ phoneSignInEnabled: user.phoneSignInEnabled, passkeyCount }, 'passkey');
      await manager.getRepository(Passkey).delete({ id: passkey.id });
    });
  }

  async disablePhoneSignIn(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({ where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new NotFoundException('User not found');
      const passkeyCount = await manager.getRepository(Passkey).count({ where: { userId } });
      assertCanRemoveSignInMethod({ phoneSignInEnabled: user.phoneSignInEnabled, passkeyCount }, 'phone');
      await manager.getRepository(User).update({ id: userId }, { phoneSignInEnabled: false });
    });
  }
}

export const toPasskeyResponse = (row: Passkey): PasskeyResponse => ({
  id: row.id,
  label: row.label,
  createdAt: row.createdAt.toISOString(),
  lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
});
