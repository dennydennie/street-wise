import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/app-config.service';
import { buildDatabaseOptions, compiledMigrationPath } from './database-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        buildDatabaseOptions(
          { databaseUrl: config.databaseUrl, databaseSsl: config.databaseSsl, databaseLogQueries: config.databaseLogQueries },
          [compiledMigrationPath],
        ),
    }),
  ],
})
export class DatabaseModule {}
