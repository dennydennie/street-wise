import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1762300000000 implements MigrationInterface {
  name = 'InitialSchema1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`CREATE TYPE "camera_check_enum" AS ENUM ('red_light', 'stop_line', 'phone_use', 'seatbelt')`);
    await queryRunner.query(`CREATE TYPE "camera_source_enum" AS ENUM ('official', 'community')`);
    await queryRunner.query(`CREATE TYPE "report_type_enum" AS ENUM ('pothole', 'robot_out', 'kombi_stop', 'flooding', 'crime_hotspot', 'camera')`);
    await queryRunner.query(`CREATE TYPE "report_status_enum" AS ENUM ('draft', 'live', 'review', 'gone', 'removed')`);
    await queryRunner.query(`CREATE TYPE "report_vote_enum" AS ENUM ('still_there', 'gone')`);
    await queryRunner.query(`CREATE TYPE "report_flag_reason_enum" AS ENUM ('names_person_or_plate', 'false_or_gone', 'abusive', 'spam', 'other')`);
    await queryRunner.query(`CREATE TYPE "pass_id_enum" AS ENUM ('day', 'week', 'month')`);
    await queryRunner.query(`CREATE TYPE "payment_method_enum" AS ENUM ('ecocash', 'paynow_web')`);
    await queryRunner.query(`CREATE TYPE "payment_status_enum" AS ENUM ('created', 'pending', 'paid', 'failed', 'cancelled')`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phone" character varying(20) NOT NULL,
        "displayName" character varying(60),
        "agreedToRulesAt" TIMESTAMP WITH TIME ZONE,
        "phoneSignInEnabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )`);

    await queryRunner.query(`
      CREATE TABLE "otp_challenges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phone" character varying(20) NOT NULL,
        "codeHash" character varying(64) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "consumedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_otp_challenges" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_otp_challenges_phone_createdAt" ON "otp_challenges" ("phone", "createdAt")`);

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "deviceLabel" character varying(80),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sessions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_userId" ON "sessions" ("userId")`);

    await queryRunner.query(`
      CREATE TABLE "passkeys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "credentialId" character varying(512) NOT NULL,
        "publicKey" text NOT NULL,
        "signCount" bigint NOT NULL DEFAULT 0,
        "label" character varying(80),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_passkeys_credentialId" UNIQUE ("credentialId"),
        CONSTRAINT "PK_passkeys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_passkeys_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_passkeys_userId" ON "passkeys" ("userId")`);

    await queryRunner.query(`
      CREATE TABLE "cameras" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "checks" "camera_check_enum" array NOT NULL DEFAULT '{}',
        "source" "camera_source_enum" NOT NULL DEFAULT 'official',
        "confidence" real NOT NULL DEFAULT 1,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cameras" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_cameras_updatedAt" ON "cameras" ("updatedAt")`);

    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reporterId" uuid NOT NULL,
        "type" "report_type_enum" NOT NULL,
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "note" character varying(140),
        "status" "report_status_enum" NOT NULL DEFAULT 'live',
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "stillThereCount" integer NOT NULL DEFAULT 0,
        "goneCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reports_reporterId" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_reports_status_expiresAt" ON "reports" ("status", "expiresAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_reports_lat_lng" ON "reports" ("lat", "lng")`);
    await queryRunner.query(`CREATE INDEX "IDX_reports_reporterId" ON "reports" ("reporterId")`);

    await queryRunner.query(`
      CREATE TABLE "report_votes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reportId" uuid NOT NULL,
        "voterId" uuid NOT NULL,
        "vote" "report_vote_enum" NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_report_votes_reportId_voterId" UNIQUE ("reportId", "voterId"),
        CONSTRAINT "PK_report_votes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_report_votes_reportId" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_report_votes_voterId" FOREIGN KEY ("voterId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_report_votes_voterId" ON "report_votes" ("voterId")`);

    await queryRunner.query(`
      CREATE TABLE "report_flags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reportId" uuid NOT NULL,
        "flaggerId" uuid NOT NULL,
        "reason" "report_flag_reason_enum" NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_report_flags_reportId_flaggerId" UNIQUE ("reportId", "flaggerId"),
        CONSTRAINT "PK_report_flags" PRIMARY KEY ("id"),
        CONSTRAINT "FK_report_flags_reportId" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_report_flags_flaggerId" FOREIGN KEY ("flaggerId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_report_flags_flaggerId" ON "report_flags" ("flaggerId")`);

    await queryRunner.query(`
      CREATE TABLE "user_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "blockerId" uuid NOT NULL,
        "blockedId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_blocks_blockerId_blockedId" UNIQUE ("blockerId", "blockedId"),
        CONSTRAINT "PK_user_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_blocks_blockerId" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_blocks_blockedId" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);

    // No foreign keys and no user columns on purpose: the log outlives account deletion.
    await queryRunner.query(`
      CREATE TABLE "moderation_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reportId" uuid,
        "reportType" character varying(32),
        "action" character varying(32) NOT NULL,
        "reason" character varying(32),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_moderation_log" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_moderation_log_reportId" ON "moderation_log" ("reportId")`);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" character varying(16) NOT NULL,
        "userId" uuid,
        "passId" "pass_id_enum" NOT NULL,
        "method" "payment_method_enum" NOT NULL,
        "status" "payment_status_enum" NOT NULL DEFAULT 'created',
        "amountCents" integer NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "payerPhone" character varying(20),
        "paynowReference" character varying(64),
        "pollUrl" text,
        "redirectUrl" text,
        "instructions" text,
        "paidAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payments_reference" UNIQUE ("reference"),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_userId_createdAt" ON "payments" ("userId", "createdAt")`);

    await queryRunner.query(`
      CREATE TABLE "user_passes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "passId" "pass_id_enum" NOT NULL,
        "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "paymentId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_passes_paymentId" UNIQUE ("paymentId"),
        CONSTRAINT "PK_user_passes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_passes_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_user_passes_userId_endsAt" ON "user_passes" ("userId", "endsAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'user_passes', 'payments', 'moderation_log', 'user_blocks', 'report_flags', 'report_votes',
      'reports', 'cameras', 'passkeys', 'sessions', 'otp_challenges', 'users',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
    for (const type of [
      'payment_status_enum', 'payment_method_enum', 'pass_id_enum', 'report_flag_reason_enum', 'report_vote_enum',
      'report_status_enum', 'report_type_enum', 'camera_source_enum', 'camera_check_enum',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${type}"`);
    }
  }
}
