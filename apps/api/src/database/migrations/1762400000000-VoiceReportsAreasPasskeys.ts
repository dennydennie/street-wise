import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Voice reports (transcript, redacted summary, severity, tags, heading,
 * capturedAt), areas for briefings, WebAuthn challenges, passkey transports and
 * payment failure reasons. Existing reports get `capturedAt = createdAt`; they
 * are assigned to areas by `pnpm db:seed` (which needs the cameras).
 */
export class VoiceReportsAreasPasskeys1762400000000 implements MigrationInterface {
  name = 'VoiceReportsAreasPasskeys1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "areas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_areas" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_areas_lat_lng" ON "areas" ("lat", "lng")`);

    await queryRunner.query(`ALTER TABLE "reports" ADD "transcript" text`);
    await queryRunner.query(`ALTER TABLE "reports" ADD "summary" character varying(160)`);
    await queryRunner.query(`ALTER TABLE "reports" ADD "severity" smallint NOT NULL DEFAULT 2`);
    await queryRunner.query(`ALTER TABLE "reports" ADD CONSTRAINT "CHK_reports_severity" CHECK ("severity" BETWEEN 1 AND 5)`);
    await queryRunner.query(`ALTER TABLE "reports" ADD "tags" text array NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "reports" ADD "areaId" uuid`);
    await queryRunner.query(`ALTER TABLE "reports" ADD "locationName" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "reports" ADD "heading" smallint`);
    await queryRunner.query(`ALTER TABLE "reports" ADD CONSTRAINT "CHK_reports_heading" CHECK ("heading" BETWEEN 0 AND 359)`);
    await queryRunner.query(`ALTER TABLE "reports" ADD "capturedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    await queryRunner.query(`UPDATE "reports" SET "capturedAt" = "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_reports_areaId" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_reports_areaId_capturedAt" ON "reports" ("areaId", "capturedAt")`);

    await queryRunner.query(`
      CREATE TABLE "webauthn_challenges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "kind" character varying(16) NOT NULL,
        "challenge" character varying(128) NOT NULL,
        "label" character varying(80),
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "usedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webauthn_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_webauthn_challenges_kind" CHECK ("kind" IN ('registration', 'authentication')),
        CONSTRAINT "FK_webauthn_challenges_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_webauthn_challenges_expiresAt" ON "webauthn_challenges" ("expiresAt")`);

    await queryRunner.query(`ALTER TABLE "passkeys" ADD "transports" character varying(16) array`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "failureReason" character varying(160)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "failureReason"`);
    await queryRunner.query(`ALTER TABLE "passkeys" DROP COLUMN "transports"`);
    await queryRunner.query(`DROP TABLE "webauthn_challenges"`);
    await queryRunner.query(`DROP INDEX "IDX_reports_areaId_capturedAt"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_reports_areaId"`);
    for (const column of ['capturedAt', 'heading', 'locationName', 'areaId', 'tags', 'severity', 'summary', 'transcript']) {
      await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "${column}"`);
    }
    await queryRunner.query(`DROP TABLE "areas"`);
  }
}
