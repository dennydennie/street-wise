import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { parseEnv } from './config/env.schema';
import { buildDatabaseOptions, migrationPathsForRuntime } from './database/database-options';

config({ path: resolve(__dirname, '../../../.env') });

const env = parseEnv(process.env);

/** Used by the TypeORM CLI (`migration:run`, `migration:deploy`) and the seed script. */
export default new DataSource(buildDatabaseOptions(env, migrationPathsForRuntime(__filename)));
