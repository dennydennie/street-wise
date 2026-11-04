import { Controller, Delete, Get, HttpCode, NotImplementedException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth-token';
import { CurrentUser } from '../current-user.decorator';
import { Public } from '../public.decorator';
import { PasskeysService } from './passkeys.service';

const NOT_YET = 'Passkey (WebAuthn) ceremonies are not implemented yet.';

/**
 * TODO(passkeys): implement the WebAuthn ceremonies (e.g. with @simplewebauthn/server):
 * store a short-lived challenge per user/session, verify attestation on
 * registration (RP id = the app's asset-links domain for Android Credential
 * Manager, and the web origin for Flutter web), verify assertions and the sign
 * counter on sign-in, then create a Session exactly like OTP verify does.
 */
@ApiTags('passkeys')
@Controller('auth/passkeys')
export class PasskeyCeremonyController {
  @ApiBearerAuth()
  @Post('registration/options')
  registrationOptions() {
    throw new NotImplementedException(NOT_YET);
  }

  @ApiBearerAuth()
  @Post('registration/verify')
  registrationVerify() {
    throw new NotImplementedException(NOT_YET);
  }

  @Public()
  @Post('authentication/options')
  authenticationOptions() {
    throw new NotImplementedException(NOT_YET);
  }

  @Public()
  @Post('authentication/verify')
  authenticationVerify() {
    throw new NotImplementedException(NOT_YET);
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
