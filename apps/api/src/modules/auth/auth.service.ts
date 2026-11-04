import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  OTP_MAX_REQUESTS_PER_WINDOW,
  OTP_REQUEST_WINDOW_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  type OtpRequestResponse,
  type OtpVerifyResponse,
} from '@streetwise/shared';
import { AppConfigService } from '../../config/app-config.service';
import { User } from '../users/entities/user.entity';
import { toUserResponse } from '../users/user.mapper';
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from './auth-token';
import { OtpChallenge } from './entities/otp-challenge.entity';
import { Session } from './entities/session.entity';
import { checkOtpCode, generateOtpCode, hashOtpCode, otpRetryAfterSeconds } from './otp/otp-code';
import { SMS_SENDER, SmsSender } from './sms/sms-sender';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: AppConfigService,
    @InjectRepository(OtpChallenge) private readonly challenges: Repository<OtpChallenge>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async requestOtp(phone: string, now = new Date()): Promise<OtpRequestResponse> {
    const existing = await this.users.findOne({ where: { phone } });
    if (existing && !existing.phoneSignInEnabled) {
      throw new ForbiddenException({ code: 'PHONE_SIGN_IN_DISABLED', message: 'Sign in with your passkey.' });
    }

    const recent = await this.challenges.find({
      where: { phone, createdAt: MoreThan(new Date(now.getTime() - OTP_REQUEST_WINDOW_SECONDS * 1000)) },
      select: { createdAt: true },
    });
    const retryAfter = otpRetryAfterSeconds(recent, now, {
      maxPerWindow: OTP_MAX_REQUESTS_PER_WINDOW,
      windowSeconds: OTP_REQUEST_WINDOW_SECONDS,
      cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
    if (retryAfter > 0) {
      throw new HttpException(
        { code: 'OTP_RATE_LIMITED', message: 'Too many codes requested. Try again shortly.', retryAfterSeconds: retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = generateOtpCode();
    await this.challenges.save(
      this.challenges.create({
        phone,
        codeHash: hashOtpCode(phone, code, this.config.otpPepper),
        expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
      }),
    );
    await this.sms.send(phone, `Your StreetWise code is ${code}. It expires in 5 minutes.`);
    return { expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS };
  }

  async verifyOtp(phone: string, code: string, deviceLabel?: string, now = new Date()): Promise<OtpVerifyResponse> {
    const challenge = await this.challenges.findOne({
      where: { phone, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!challenge) throw invalidCode();

    const result = checkOtpCode(challenge, code, this.config.otpPepper, now);
    if (result === 'invalid') {
      await this.challenges.increment({ id: challenge.id }, 'attempts', 1);
      throw invalidCode();
    }
    if (result === 'expired' || result === 'consumed') {
      throw new BadRequestException({ code: 'OTP_EXPIRED', message: 'That code has expired. Request a new one.' });
    }
    if (result === 'too_many_attempts') {
      throw new HttpException({ code: 'OTP_LOCKED', message: 'Too many wrong codes. Request a new one.' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Consume atomically so two parallel verifies cannot both succeed.
    const consumed = await this.challenges.update({ id: challenge.id, consumedAt: IsNull() }, { consumedAt: now });
    if (!consumed.affected) throw invalidCode();

    let user = await this.users.findOne({ where: { phone } });
    const isNewUser = !user;
    if (!user) {
      user = await this.users.save(this.users.create({ phone }));
    } else if (!user.phoneSignInEnabled) {
      throw new ForbiddenException({ code: 'PHONE_SIGN_IN_DISABLED', message: 'Sign in with your passkey.' });
    }

    const session = await this.sessions.save(this.sessions.create({ userId: user.id, deviceLabel: deviceLabel ?? null, lastSeenAt: now }));
    return {
      accessToken: signAccessToken({ userId: user.id, sessionId: session.id }, this.config.apiJwtSecret),
      tokenType: 'Bearer',
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      isNewUser,
      user: toUserResponse(user),
    };
  }
}

const invalidCode = () => new BadRequestException({ code: 'OTP_INVALID', message: 'That code is not right.' });
