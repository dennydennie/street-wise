import type { DataSourceOptions } from 'typeorm';
import type { ApiEnv } from '../config/env.schema';
import { entities } from './entities';

export const compiledMigrationPath = 'dist/database/migrations/*.js';
export const sourceMigrationPath = 'src/database/migrations/*.ts';

export const migrationPathsForRuntime = (filename: string): string[] => [
  filename.endsWith('.js') ? compiledMigrationPath : sourceMigrationPath,
];

type DatabaseConfig = Pick<ApiEnv, 'databaseUrl' | 'databaseSsl' | 'databaseLogQueries'>;

export const buildDatabaseOptions = (config: DatabaseConfig, migrations: string[]): DataSourceOptions => ({
  type: 'postgres',
  url: config.databaseUrl,
  synchronize: false,
  logging: config.databaseLogQueries ? 'all' : ['error', 'warn', 'migration'],
  entities,
  migrations,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
});
