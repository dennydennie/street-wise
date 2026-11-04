import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AppConfigService } from '../../../config/app-config.service';
import type { User } from '../../users/entities/user.entity';
import type { AuthService } from '../auth.service';
import type { Passkey } from '../entities/passkey.entity';
import type { WebauthnChallenge } from '../entities/webauthn-challenge.entity';
import { PasskeyCeremonyService, WEBAUTHN_CHALLENGE_TTL_MS } from './passkey-ceremony.service';

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(async () => ({ challenge: 'reg-challenge', rp: { id: 'localhost' } })),
  generateAuthenticationOptions: jest.fn(async () => ({ challenge: 'auth-challenge', rpId: 'localhost', allowCredentials: [] })),
  verifyRegistrationResponse: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webauthn = require('@simplewebauthn/server') as Record<string, jest.Mock>;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-11-04T08:00:00Z');
const clientData = (origin: string) => Buffer.from(JSON.stringify({ type: 'webauthn.get', origin, challenge: 'x' })).toString('base64url');
const assertion = (origin = 'http://localhost:53100', id = 'cred-1') => ({
  id,
  rawId: id,
  type: 'public-key',
  response: { clientDataJSON: clientData(origin), authenticatorData: 'AA', signature: 'AA' },
  clientExtensionResults: {},
});

const setup = (challengeOverrides: Partial<WebauthnChallenge> = {}, passkeyOverrides: Partial<Passkey> = {}) => {
  const challenge = {
    id: 'ch-1',
    userId: null,
    kind: 'authentication',
    challenge: 'auth-challenge',
    label: null,
    expiresAt: new Date(NOW.getTime() + WEBAUTHN_CHALLENGE_TTL_MS),
    usedAt: null,
    ...challengeOverrides,
  } as WebauthnChallenge;
  const challenges = {
    findOne: jest.fn(async () => challenge),
    // Single use: only the first conditional update matches.
    update: jest.fn(async () => {
      if (challenge.usedAt) return { affected: 0 };
      challenge.usedAt = NOW;
      return { affected: 1 };
    }),
    delete: jest.fn(async () => ({})),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'ch-new', ...value })),
  };
  const passkey = {
    id: 'pk-1',
    userId: USER_ID,
    credentialId: 'cred-1',
    publicKey: Buffer.from('public-key').toString('base64url'),
    signCount: '5',
    transports: ['internal'],
    ...passkeyOverrides,
  } as Passkey;
  const passkeys = {
    findOne: jest.fn(async ({ where }: { where: { credentialId: string } }) => (where.credentialId === passkey.credentialId ? passkey : null)),
    update: jest.fn(async () => ({ affected: 1 })),
    find: jest.fn(async () => [passkey]),
  };
  const user = { id: USER_ID, phone: '+263771234567', displayName: null } as User;
  const users = { findOne: jest.fn(async () => user) };
  const session = { accessToken: 'token', tokenType: 'Bearer', expiresInSeconds: 1, isNewUser: false, user: { id: USER_ID } };
  const auth = { issueSession: jest.fn(async () => session) };
  const config = {
    webauthnRpId: 'localhost',
    webauthnRpName: 'StreetWise ZW',
    webauthnOrigins: ['http://localhost:*'],
    androidSha256CertFingerprints: [],
  } as unknown as AppConfigService;

  const service = new PasskeyCeremonyService(
    config,
    auth as unknown as AuthService,
    challenges as unknown as Repository<WebauthnChallenge>,
    passkeys as unknown as Repository<Passkey>,
    users as unknown as Repository<User>,
  );
  return { service, challenge, challenges, passkeys, auth, session };
};

const verified = (newCounter: number) =>
  webauthn.verifyAuthenticationResponse.mockResolvedValue({ verified: true, authenticationInfo: { newCounter, credentialID: 'cred-1' } });

beforeEach(() => jest.clearAllMocks());

describe('PasskeyCeremonyService challenges', () => {
  it('issues a 5-minute single-use challenge with the options', async () => {
    const { service, challenges } = setup();
    const result = await service.authenticationOptions(undefined, NOW);
    expect(result).toEqual({ challengeId: 'ch-new', options: expect.objectContaining({ challenge: 'auth-challenge' }) });
    expect(challenges.save).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'authentication', challenge: 'auth-challenge', expiresAt: new Date(NOW.getTime() + 5 * 60_000) }),
    );
  });

  it('rejects an expired challenge with 400', async () => {
    const { service } = setup({ expiresAt: new Date(NOW.getTime() - 1) });
    await expect(service.authenticationVerify({ challengeId: 'ch-1', response: assertion() as never }, NOW)).rejects.toMatchObject({
      response: { code: 'CHALLENGE_EXPIRED' },
    });
  });

  it('accepts a challenge once, then rejects the replay with 400', async () => {
    const { service, auth, session } = setup();
    verified(6);
    await expect(service.authenticationVerify({ challengeId: 'ch-1', response: assertion() as never, deviceLabel: 'Pixel' }, NOW)).resolves.toBe(session);
    expect(auth.issueSession).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID }), { deviceLabel: 'Pixel', isNewUser: false, now: NOW });

    const replay = service.authenticationVerify({ challengeId: 'ch-1', response: assertion() as never }, NOW);
    await expect(replay).rejects.toBeInstanceOf(BadRequestException);
    await expect(replay).rejects.toMatchObject({ response: { code: 'CHALLENGE_USED' } });
  });

  it('consumes the challenge even when verification fails', async () => {
    const { service, challenge } = setup();
    webauthn.verifyAuthenticationResponse.mockRejectedValue(new Error('bad signature'));
    await expect(service.authenticationVerify({ challengeId: 'ch-1', response: assertion() as never }, NOW)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(challenge.usedAt).toEqual(NOW);
  });

  it('rejects a registration challenge used for sign-in', async () => {
    const { service, challenges } = setup();
    challenges.findOne.mockResolvedValue(null as never);
    await expect(service.authenticationVerify({ challengeId: 'ch-1', response: assertion() as never }, NOW)).rejects.toMatchObject({
      response: { code: 'CHALLENGE_INVALID' },
    });
  });
});

describe('PasskeyCeremonyService sign-in', () => {
  it('rejects an unknown credential with 401', async () => {
    const { service } = setup();
    await expect(
      service.authenticationVerify({ challengeId: 'ch-1', response: assertion('http://localhost:53100', 'nope') as never }, NOW),
    ).rejects.toMatchObject({ status: 401, response: { code: 'PASSKEY_UNKNOWN' } });
    expect(webauthn.verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it('rejects a sign counter that goes backwards', async () => {
    const { service, passkeys } = setup();
    verified(5);
    await expect(service.authenticationVerify({ challengeId: 'ch-1', response: assertion() as never }, NOW)).rejects.toMatchObject({
      status: 401,
      response: { code: 'PASSKEY_COUNTER' },
    });
    expect(passkeys.update).not.toHaveBeenCalled();
  });

  it('updates the counter and last-used time on success', async () => {
    const { service, passkeys } = setup();
    verified(9);
    await service.authenticationVerify({ challengeId: 'ch-1', response: assertion() as never }, NOW);
    expect(passkeys.update).toHaveBeenCalledWith({ id: 'pk-1' }, { signCount: '9', lastUsedAt: NOW });
    expect(webauthn.verifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({ expectedChallenge: 'auth-challenge', expectedOrigin: 'http://localhost:53100', expectedRPID: 'localhost' }),
    );
  });

  it('refuses an origin that is not configured', async () => {
    const { service } = setup();
    await expect(
      service.authenticationVerify({ challengeId: 'ch-1', response: assertion('https://evil.example') as never }, NOW),
    ).rejects.toMatchObject({ status: 400, response: { code: 'ORIGIN_NOT_ALLOWED' } });
  });

  it('refuses a passkey from another account when the challenge named a user', async () => {
    const { service } = setup({ userId: '22222222-2222-4222-8222-222222222222' });
    await expect(service.authenticationVerify({ challengeId: 'ch-1', response: assertion() as never }, NOW)).rejects.toMatchObject({
      status: 401,
    });
  });
});
