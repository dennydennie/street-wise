import { ConflictException } from '@nestjs/common';

export type SignInMethodsState = { phoneSignInEnabled: boolean; passkeyCount: number };

export const countSignInMethods = (state: SignInMethodsState): number =>
  (state.phoneSignInEnabled ? 1 : 0) + state.passkeyCount;

/** Refuses any removal that would leave the account with no way to sign in. */
export const assertCanRemoveSignInMethod = (state: SignInMethodsState, removing: 'phone' | 'passkey'): void => {
  const remaining = countSignInMethods({
    phoneSignInEnabled: removing === 'phone' ? false : state.phoneSignInEnabled,
    passkeyCount: removing === 'passkey' ? Math.max(0, state.passkeyCount - 1) : state.passkeyCount,
  });
  if (remaining < 1) {
    throw new ConflictException({
      code: 'LAST_SIGN_IN_METHOD',
      message: 'This is your only way to sign in. Add another before removing it.',
    });
  }
};
