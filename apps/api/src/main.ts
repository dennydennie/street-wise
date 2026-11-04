import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { AppConfigService } from './config/app-config.service';
import { setupSwagger, shouldExposeSwaggerUi } from './openapi';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  // rawBody: the Paynow result hash is checked against the fields in the order they were sent.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(AppConfigService);

  configureApp(app, { trustProxyHops: config.trustProxyHops });
  if (shouldExposeSwaggerUi(config)) {
    setupSwagger(app);
    logger.log(`Swagger UI at ${config.apiPublicBaseUrl}/docs`);
  }
  app.enableShutdownHooks();

  await app.listen(config.apiPort);
  logger.log(`Listening on port ${config.apiPort} (Paynow mode: ${config.paynowMode})`);
}

bootstrap().catch((error) => {
  logger.error('Failed to start API', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
