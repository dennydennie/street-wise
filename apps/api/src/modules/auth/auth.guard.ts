import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { verifyAccessToken } from './auth-token';
import type { RequestWithUser } from './current-user.decorator';
import { Session } from './entities/session.entity';
import { IS_PUBLIC_KEY } from './public.decorator';

const LAST_SEEN_RESOLUTION_MS = 5 * 60_000;

/** Global guard: every route needs a live session unless marked `@Public()`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = await this.authenticate(request);

    if (user) {
      request.user = user;
      return true;
    }
    if (isPublic) return true;
    throw new UnauthorizedException('Sign in required');
  }

  private async authenticate(request: RequestWithUser) {
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.startsWith('Bearer ')) return null;

    const claims = verifyAccessToken(value.slice('Bearer '.length).trim(), this.config.apiJwtSecret);
    if (!claims) return null;

    const session = await this.sessions.findOne({
      where: { id: claims.sessionId, userId: claims.userId, revokedAt: IsNull() },
    });
    if (!session) return null;

    const now = new Date();
    if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_RESOLUTION_MS) {
      await this.sessions.update({ id: session.id }, { lastSeenAt: now });
    }
    return claims;
  }
}
