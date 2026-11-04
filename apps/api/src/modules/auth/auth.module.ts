import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OtpChallenge } from './entities/otp-challenge.entity';
import { Passkey } from './entities/passkey.entity';
import { Session } from './entities/session.entity';
import { WebauthnChallenge } from './entities/webauthn-challenge.entity';
import { PasskeyCeremonyService } from './passkeys/passkey-ceremony.service';
import { MyPasskeysController, PasskeyCeremonyController } from './passkeys/passkeys.controller';
import { PasskeysService } from './passkeys/passkeys.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, OtpChallenge, Session, Passkey, WebauthnChallenge])],
  controllers: [AuthController, PasskeyCeremonyController, MyPasskeysController],
  providers: [
    AuthService,
    PasskeysService,
    PasskeyCeremonyService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TypeOrmModule],
})
export class AuthModule {}
