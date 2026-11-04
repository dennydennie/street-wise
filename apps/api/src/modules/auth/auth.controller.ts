import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { OtpRequestDto, OtpVerifyDto } from './dto/auth.dto';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('otp/request')
  @HttpCode(202)
  request(@Body() body: OtpRequestDto) {
    return this.auth.requestOtp(body.phone);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  verify(@Body() body: OtpVerifyDto) {
    return this.auth.verifyOtp(body.phone, body.code, body.deviceLabel);
  }
}
