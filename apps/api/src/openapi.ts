import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

type SwaggerUiConfig = { nodeEnv: string; swaggerUiEnabled: boolean };

export const setupSwagger = (app: INestApplication): void => {
  const config = new DocumentBuilder()
    .setTitle('StreetWise ZW API')
    .setDescription('Camera robots, community hazard reports and Plus passes for Harare drivers.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
};

/** Never in production, and elsewhere only when SWAGGER_UI_ENABLED=true. */
export const shouldExposeSwaggerUi = (config: SwaggerUiConfig): boolean =>
  config.swaggerUiEnabled && config.nodeEnv !== 'production';
