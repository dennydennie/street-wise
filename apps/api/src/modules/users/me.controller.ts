import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth-token';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateMeDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getMe(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateMeDto) {
    return this.users.updateMe(user.userId, body);
  }

  @Delete()
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser) {
    return this.users.deleteMe(user.userId);
  }

  @Get('export')
  export(@CurrentUser() user: AuthenticatedUser) {
    return this.users.exportMe(user.userId, user.sessionId);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.users.listSessions(user.userId, user.sessionId);
  }

  @Post('sessions/sign-out-others')
  @HttpCode(200)
  signOutOthers(@CurrentUser() user: AuthenticatedUser) {
    return this.users.revokeOtherSessions(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.revokeSession(user.userId, id);
  }
}
