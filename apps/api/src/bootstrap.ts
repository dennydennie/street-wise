import { INestApplication, ValidationPipe } from '@nestjs/common';

type BootstrapOptions = { trustProxyHops?: number };

/** Shared by `main.ts` and any e2e test that boots the app. */
export const configureApp = (app: INestApplication, options: BootstrapOptions = {}): void => {
  if ((options.trustProxyHops ?? 0) > 0) {
    const instance = app.getHttpAdapter().getInstance() as { set?: (key: string, value: unknown) => unknown };
    instance.set?.('trust proxy', options.trustProxyHops);
  }
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
};
