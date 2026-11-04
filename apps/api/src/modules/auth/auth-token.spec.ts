import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken, verifyAccessToken } from './auth-token';

const secret = 'local-test-secret-with-enough-length-0000';
const user = { userId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222' };

describe('access token', () => {
  it('round-trips the user and session', () => {
    expect(verifyAccessToken(signAccessToken(user, secret, 1000), secret, 1001)).toEqual(user);
  });

  it('rejects a token signed with another secret', () => {
    expect(verifyAccessToken(signAccessToken(user, 'another-secret-another-secret-0000'), secret)).toBeNull();
  });

  it('rejects an expired token', () => {
    expect(verifyAccessToken(signAccessToken(user, secret, 1000), secret, 1000 + ACCESS_TOKEN_TTL_SECONDS)).toBeNull();
  });
});
