import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { OtpVerifyResponse, Passkey as PasskeyResponse, PasskeyOptionsResponse } from '@streetwise/shared';
import { IsNull, LessThan, Repository } from 'typeorm';
import { AppConfigService } from '../../../config/app-config.service';
import { androidApkKeyHashOrigin, createOriginMatcher, type OriginMatcher } from '../../../config/origins';
import { User } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';
import { Passkey } from '../entities/passkey.entity';
import { WebauthnChallenge, type WebauthnChallengeKind } from '../entities/webauthn-challenge.entity';
import { toPasskeyResponse } from './passkeys.service';

export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60_000;
const CEREMONY_TIMEOUT_MS = 120_000;
/** EdDSA, ES256, RS256: what Android Credential Manager, iCloud Keychain and browsers all support. */
const SUPPORTED_ALGORITHMS = [-8, -7, -257];
const DAY_MS = 86_400_000;

const fail = (status: 400 | 401, code: string, message: string) =>
  status === 400 ? new BadRequestException({ code, message }) : new UnauthorizedException({ code, message });

/** The origin the browser / Credential Manager put in clientDataJSON. */
export const clientDataOrigin = (clientDataJSON: unknown): string => {
  try {
    const parsed = JSON.parse(Buffer.from(String(clientDataJSON), 'base64url').toString('utf8')) as { origin?: unknown };
    if (typeof parsed.origin === 'string') return parsed.origin;
  } catch {
    // fall through
  }
  throw fail(400, 'PASSKEY_INVALID', 'The passkey response is malformed.');
};

/** UUID → its 16 bytes: the WebAuthn user handle. */
const userHandle = (userId: string) => new Uint8Array(Buffer.from(userId.replace(/-/g, ''), 'hex'));

/**
 * WebAuthn ceremonies (simplewebauthn). The relying party is WEBAUTHN_RP_ID;
 * accepted origins are WEBAUTHN_ORIGINS plus the Android apk-key-hash origins
 * derived from ANDROID_SHA256_CERT_FINGERPRINTS. Challenges live for 5 minutes
 * and the first verify attempt consumes them, whatever its outcome.
 */
@Injectable()
export class PasskeyCeremonyService {
  private readonly logger = new Logger('Passkeys');
  private readonly originAllowed: OriginMatcher;

  constructor(
    private readonly config: AppConfigService,
    private readonly auth: AuthService,
    @InjectRepository(WebauthnChallenge) private readonly challenges: Repository<WebauthnChallenge>,
    @InjectRepository(Passkey) private readonly passkeys: Repository<Passkey>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.originAllowed = createOriginMatcher([
      ...config.webauthnOrigins,
      ...config.androidSha256CertFingerprints.map(androidApkKeyHashOrigin),
    ]);
  }

  async registrationOptions(userId: string, label: string | undefined, now = new Date()): Promise<PasskeyOptionsResponse> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const existing = await this.passkeys.find({ where: { userId } });
    const options = await generateRegistrationOptions({
      rpName: this.config.webauthnRpName,
      rpID: this.config.webauthnRpId,
      userName: user.phone,
      userDisplayName: user.displayName ?? user.phone,
      userID: userHandle(user.id),
      timeout: CEREMONY_TIMEOUT_MS,
      attestationType: 'none',
      supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
      excludeCredentials: existing.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports ?? undefined })),
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' },
    });
    const challenge = await this.saveChallenge('registration', options.challenge, userId, label?.trim() || null, now);
    return { challengeId: challenge.id, options: options as unknown as Record<string, unknown> };
  }

  async registrationVerify(
    userId: string,
    body: { challengeId: string; response: RegistrationResponseJSON; label?: string },
    now = new Date(),
  ): Promise<PasskeyResponse> {
    const challenge = await this.consumeChallenge(body.challengeId, 'registration', now);
    if (challenge.userId !== userId) throw fail(400, 'CHALLENGE_INVALID', 'That passkey request is not valid. Start again.');
    const origin = this.checkOrigin(body.response?.response?.clientDataJSON);

    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: this.config.webauthnRpId,
        requireUserVerification: false,
        supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
      });
    } catch (error) {
      this.logger.warn(`Passkey registration rejected: ${(error as Error).message}`);
      throw fail(400, 'PASSKEY_INVALID', 'The passkey could not be verified.');
    }
    if (!verification.verified) throw fail(400, 'PASSKEY_INVALID', 'The passkey could not be verified.');

    const { credential } = verification.registrationInfo;
    if (await this.passkeys.exists({ where: { credentialId: credential.id } })) {
      throw new ConflictException({ code: 'PASSKEY_EXISTS', message: 'This passkey is already registered.' });
    }
    const saved = await this.passkeys.save(
      this.passkeys.create({
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        signCount: String(credential.counter),
        transports: credential.transports ?? body.response.response.transports ?? null,
        label: body.label?.trim() || challenge.label || null,
      }),
    );
    return toPasskeyResponse(saved);
  }

  /** With a known phone, only that account's passkeys are offered; otherwise any discoverable passkey. */
  async authenticationOptions(phone: string | undefined, now = new Date()): Promise<PasskeyOptionsResponse> {
    const user = phone ? await this.users.findOne({ where: { phone } }) : null;
    const allow = user ? await this.passkeys.find({ where: { userId: user.id } }) : [];
    const options = await generateAuthenticationOptions({
      rpID: this.config.webauthnRpId,
      timeout: CEREMONY_TIMEOUT_MS,
      userVerification: 'preferred',
      allowCredentials: allow.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports ?? undefined })),
    });
    const challenge = await this.saveChallenge('authentication', options.challenge, user?.id ?? null, null, now);
    return { challengeId: challenge.id, options: options as unknown as Record<string, unknown> };
  }

  async authenticationVerify(
    body: { challengeId: string; response: AuthenticationResponseJSON; deviceLabel?: string },
    now = new Date(),
  ): Promise<OtpVerifyResponse> {
    const challenge = await this.consumeChallenge(body.challengeId, 'authentication', now);
    const credentialId = typeof body.response?.id === 'string' ? body.response.id : '';
    const passkey = credentialId ? await this.passkeys.findOne({ where: { credentialId } }) : null;
    if (!passkey) throw fail(401, 'PASSKEY_UNKNOWN', 'This passkey is not registered. Sign in with your phone.');
    if (challenge.userId && challenge.userId !== passkey.userId) {
      throw fail(401, 'PASSKEY_UNKNOWN', 'This passkey belongs to another account.');
    }
    const origin = this.checkOrigin(body.response.response?.clientDataJSON);

    const storedCounter = Number(passkey.signCount);
    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: this.config.webauthnRpId,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
          counter: storedCounter,
          transports: passkey.transports ?? undefined,
        },
        requireUserVerification: false,
      });
    } catch (error) {
      this.logger.warn(`Passkey sign-in rejected: ${(error as Error).message}`);
      throw fail(401, 'PASSKEY_INVALID', 'The passkey could not be verified.');
    }
    if (!verification.verified) throw fail(401, 'PASSKEY_INVALID', 'The passkey could not be verified.');

    // A counter that does not move forward suggests a cloned authenticator (0 means "not supported").
    const { newCounter } = verification.authenticationInfo;
    if ((storedCounter > 0 || newCounter > 0) && newCounter <= storedCounter) {
      this.logger.warn(`Passkey ${passkey.id} counter regression: ${newCounter} <= ${storedCounter}`);
      throw fail(401, 'PASSKEY_COUNTER', 'This passkey looks cloned and was refused.');
    }

    const user = await this.users.findOne({ where: { id: passkey.userId } });
    if (!user) throw fail(401, 'PASSKEY_UNKNOWN', 'This passkey is not registered.');
    await this.passkeys.update({ id: passkey.id }, { signCount: String(newCounter), lastUsedAt: now });
    return this.auth.issueSession(user, { deviceLabel: body.deviceLabel, isNewUser: false, now });
  }

  // ── helpers ────────────────────────────────────────
  private async saveChallenge(kind: WebauthnChallengeKind, value: string, userId: string | null, label: string | null, now: Date) {
    // Housekeeping: challenges are useless a day after they expire.
    await this.challenges.delete({ expiresAt: LessThan(new Date(now.getTime() - DAY_MS)) });
    return this.challenges.save(
      this.challenges.create({ kind, challenge: value, userId, label, expiresAt: new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MS) }),
    );
  }

  /** Single use: the first verify consumes the challenge, even if verification then fails. */
  async consumeChallenge(id: string, kind: WebauthnChallengeKind, now: Date): Promise<WebauthnChallenge> {
    const challenge = await this.challenges.findOne({ where: { id, kind } });
    if (!challenge) throw fail(400, 'CHALLENGE_INVALID', 'That passkey request is not valid. Start again.');
    if (challenge.usedAt) throw fail(400, 'CHALLENGE_USED', 'That passkey request was already used. Start again.');
    if (challenge.expiresAt.getTime() <= now.getTime()) throw fail(400, 'CHALLENGE_EXPIRED', 'That passkey request expired. Start again.');
    const consumed = await this.challenges.update({ id, usedAt: IsNull() }, { usedAt: now });
    if (!consumed.affected) throw fail(400, 'CHALLENGE_USED', 'That passkey request was already used. Start again.');
    return challenge;
  }

  private checkOrigin(clientDataJSON: unknown): string {
    const origin = clientDataOrigin(clientDataJSON);
    if (!this.originAllowed(origin)) throw fail(400, 'ORIGIN_NOT_ALLOWED', `Passkeys are not enabled for ${origin}.`);
    return origin;
  }
}
