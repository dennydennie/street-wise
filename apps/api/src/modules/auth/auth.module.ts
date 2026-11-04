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
import { MyPasskeysController, PasskeyCeremonyController } from './passkeys/passkeys.controller';
import { PasskeysService } from './passkeys/passkeys.service';
import { ConsoleSmsSender, SMS_SENDER } from './sms/sms-sender';

@Module({
  imports: [TypeOrmModule.forFeature([User, OtpChallenge, Session, Passkey])],
  controllers: [AuthController, PasskeyCeremonyController, MyPasskeysController],
  providers: [
    AuthService,
    PasskeysService,
    // Only `console` exists today; add a real provider here and in env.schema.ts.
    { provide: SMS_SENDER, useClass: ConsoleSmsSender },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TypeOrmModule],
})
export class AuthModule {}
