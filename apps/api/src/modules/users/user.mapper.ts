import type { User as UserResponse } from '@streetwise/shared';
import type { User } from './entities/user.entity';

export const toUserResponse = (user: User): UserResponse => ({
  id: user.id,
  phone: user.phone,
  displayName: user.displayName,
  agreedToRulesAt: user.agreedToRulesAt?.toISOString() ?? null,
  createdAt: user.createdAt.toISOString(),
});
