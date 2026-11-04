import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth-token';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { PassesService } from './passes.service';

@ApiTags('passes')
@Controller()
export class PassesController {
  constructor(private readonly passes: PassesService) {}

  @Public()
  @Get('passes/catalogue')
  catalogue() {
    return this.passes.catalogue();
  }

  @ApiBearerAuth()
  @Get('me/pass')
  myPass(@CurrentUser() user: AuthenticatedUser) {
    return this.passes.myPass(user.userId);
  }
}
