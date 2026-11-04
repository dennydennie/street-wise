import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth-token';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { BriefingsService } from './briefings.service';
import { AtQuery, BriefingsQuery } from './dto/briefings.dto';

/** Public; when signed in, reports from reporters you blocked are left out. */
@ApiTags('briefings')
@ApiBearerAuth()
@Controller()
export class AreasController {
  constructor(private readonly briefings: BriefingsService) {}

  @Public()
  @Get('briefings')
  list(@Query() query: BriefingsQuery, @CurrentUser() user?: AuthenticatedUser) {
    return this.briefings.briefings(query, user?.userId);
  }

  @Public()
  @Get('areas/:id')
  area(@Param('id', ParseUUIDPipe) id: string, @Query() query: AtQuery, @CurrentUser() user?: AuthenticatedUser) {
    return this.briefings.area(id, query.at, user?.userId);
  }
}
