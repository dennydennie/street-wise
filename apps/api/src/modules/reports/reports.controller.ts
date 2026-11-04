import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth-token';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreateBlockDto, CreateReportDto, FlagDto, ListReportsQuery, UpdateReportDto, VoteDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Public; when signed in, reports from reporters you blocked are left out. */
  @Public()
  @Get()
  list(@Query() query: ListReportsQuery, @CurrentUser() user?: AuthenticatedUser) {
    return this.reports.listInBbox(query.bbox, user?.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateReportDto) {
    return this.reports.create(user.userId, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateReportDto) {
    return this.reports.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.remove(user.userId, id);
  }

  @Post(':id/votes')
  @HttpCode(200)
  vote(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: VoteDto) {
    return this.reports.vote(user.userId, id, body.vote);
  }

  @Post(':id/flags')
  @HttpCode(202)
  flag(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: FlagDto) {
    return this.reports.flag(user.userId, id, body);
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MyReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports')
  myReports(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.myReports(user.userId);
  }

  @Delete('reports')
  eraseMyReports(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.eraseMyReports(user.userId);
  }

  @Get('blocks')
  blocks(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.listBlocks(user.userId);
  }

  @Post('blocks')
  block(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBlockDto) {
    return this.reports.blockReporterOf(user.userId, body.reportId);
  }

  @Delete('blocks/:id')
  @HttpCode(204)
  unblock(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.unblock(user.userId, id);
  }
}
