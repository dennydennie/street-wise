import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { AppConfigService } from './app-config.service';
import { parseEnv } from './env.schema';

@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: AppConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          // The monorepo keeps one `.env` at the root (`cp .env.local.example .env`).
          envFilePath: [resolve(__dirname, '../../../../.env'), resolve(process.cwd(), '.env')],
          validate: parseEnv,
        }),
      ],
    };
  }
}
