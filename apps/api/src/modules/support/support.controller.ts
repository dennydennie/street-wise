import { Body, Controller, HttpCode, Logger, Post, Req, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { SlidingWindowRateLimiter } from '../../common/rate-limiter';
import type { AuthenticatedUser } from '../auth/auth-token';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { SupportMessageDto } from './dto/support.dto';

/** 5 messages per hour per signed-in user, or per IP for anonymous listeners. */
const limiter = new SlidingWindowRateLimiter(5, 60 * 60_000);

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  private readonly logger = new Logger(SupportController.name);

  constructor(
    private readonly notifications: NotificationsService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Help › Report a bug or wrong camera. E-mailed to SUPPORT_EMAIL (SendGrid). */
  @Public()
  @Post('messages')
  @HttpCode(202)
  async create(@Body() body: SupportMessageDto, @Req() req: Request, @CurrentUser() viewer?: AuthenticatedUser) {
    limiter.consume(viewer ? `user:${viewer.userId}` : `ip:${req.ip ?? 'unknown'}`);
    const user = viewer ? await this.users.findOne({ where: { id: viewer.userId } }) : null;
    try {
      await this.notifications.supportMessage({
        ...body,
        userId: user?.id,
        phone: user?.phone ?? null,
        displayName: user?.displayName ?? null,
      });
    } catch (error) {
      this.logger.error(`Support e-mail failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException({ code: 'SUPPORT_UNAVAILABLE', message: 'Could not send your message. Try again later.' });
    }
    return { status: 'received' };
  }
}
