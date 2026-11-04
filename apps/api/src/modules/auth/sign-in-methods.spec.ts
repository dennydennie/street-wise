import { ConflictException } from '@nestjs/common';
import { assertCanRemoveSignInMethod, countSignInMethods } from './sign-in-methods';

describe('sign-in methods', () => {
  it('counts phone and passkeys', () => {
    expect(countSignInMethods({ phoneSignInEnabled: true, passkeyCount: 2 })).toBe(3);
  });

  it('refuses removing the only passkey when SMS sign-in is off', () => {
    expect(() => assertCanRemoveSignInMethod({ phoneSignInEnabled: false, passkeyCount: 1 }, 'passkey')).toThrow(ConflictException);
  });

  it('refuses turning off SMS sign-in when there is no passkey', () => {
    expect(() => assertCanRemoveSignInMethod({ phoneSignInEnabled: true, passkeyCount: 0 }, 'phone')).toThrow(ConflictException);
  });

  it('allows removing a passkey while SMS sign-in remains', () => {
    expect(() => assertCanRemoveSignInMethod({ phoneSignInEnabled: true, passkeyCount: 1 }, 'passkey')).not.toThrow();
  });

  it('allows removing one of two passkeys', () => {
    expect(() => assertCanRemoveSignInMethod({ phoneSignInEnabled: false, passkeyCount: 2 }, 'passkey')).not.toThrow();
  });
});
