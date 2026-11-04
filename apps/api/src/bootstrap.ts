import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { OriginMatcher } from './config/origins';

type BootstrapOptions = { trustProxyHops?: number; corsOrigin?: OriginMatcher };

/** Shared by `main.ts` and any e2e test that boots the app. */
export const configureApp = (app: INestApplication, options: BootstrapOptions = {}): void => {
  if ((options.trustProxyHops ?? 0) > 0) {
    const instance = app.getHttpAdapter().getInstance() as { set?: (key: string, value: unknown) => unknown };
    instance.set?.('trust proxy', options.trustProxyHops);
  }
  const allowOrigin = options.corsOrigin ?? (() => false);
  app.enableCors({
    // Requests without an Origin (mobile apps, curl) are not CORS requests and pass through.
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) =>
      callback(null, !origin || allowOrigin(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
};
