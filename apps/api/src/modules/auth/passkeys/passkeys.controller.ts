import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { AuthenticatedUser } from '../auth-token';
import { CurrentUser } from '../current-user.decorator';
import {
  PasskeyAuthenticationOptionsDto,
  PasskeyAuthenticationVerifyDto,
  PasskeyRegistrationOptionsDto,
  PasskeyRegistrationVerifyDto,
} from '../dto/passkeys.dto';
import { Public } from '../public.decorator';
import { PasskeyCeremonyService } from './passkey-ceremony.service';
import { PasskeysService } from './passkeys.service';

/**
 * WebAuthn ceremonies. RP id = WEBAUTHN_RP_ID (the asset-links domain for
 * Android Credential Manager, `localhost` in dev); accepted origins =
 * WEBAUTHN_ORIGINS + android:apk-key-hash origins from the signing certs.
 */
@ApiTags('passkeys')
@Controller('auth/passkeys')
export class PasskeyCeremonyController {
  constructor(private readonly ceremonies: PasskeyCeremonyService) {}

  @ApiBearerAuth()
  @Post('registration/options')
  @HttpCode(200)
  registrationOptions(@CurrentUser() user: AuthenticatedUser, @Body() body: PasskeyRegistrationOptionsDto) {
    return this.ceremonies.registrationOptions(user.userId, body.label);
  }

  @ApiBearerAuth()
  @Post('registration/verify')
  @HttpCode(201)
  registrationVerify(@CurrentUser() user: AuthenticatedUser, @Body() body: PasskeyRegistrationVerifyDto) {
    return this.ceremonies.registrationVerify(user.userId, {
      challengeId: body.challengeId,
      response: body.response as unknown as RegistrationResponseJSON,
      label: body.label,
    });
  }

  @Public()
  @Post('authentication/options')
  @HttpCode(200)
  authenticationOptions(@Body() body: PasskeyAuthenticationOptionsDto) {
    return this.ceremonies.authenticationOptions(body.phone);
  }

  /** Same response as `POST /auth/otp/verify`. */
  @Public()
  @Post('authentication/verify')
  @HttpCode(200)
  authenticationVerify(@Body() body: PasskeyAuthenticationVerifyDto) {
    return this.ceremonies.authenticationVerify({
      challengeId: body.challengeId,
      response: body.response as unknown as AuthenticationResponseJSON,
      deviceLabel: body.deviceLabel,
    });
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MyPasskeysController {
  constructor(private readonly passkeys: PasskeysService) {}

  @Get('passkeys')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.passkeys.list(user.userId);
  }

  @Delete('passkeys/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.passkeys.remove(user.userId, id);
  }

  @Get('sign-in-methods')
  signInMethods(@CurrentUser() user: AuthenticatedUser) {
    return this.passkeys.signInMethods(user.userId);
  }

  /** Turns off SMS-code sign-in; refused unless a passkey remains. */
  @Delete('sign-in-methods/phone')
  @HttpCode(204)
  disablePhone(@CurrentUser() user: AuthenticatedUser) {
    return this.passkeys.disablePhoneSignIn(user.userId);
  }
}
