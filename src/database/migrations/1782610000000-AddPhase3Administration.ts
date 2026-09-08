import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhase3Administration1782610000000 implements MigrationInterface {
  name = 'AddPhase3Administration1782610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD COLUMN "demo_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "organizations" SET "demo_enabled" = true WHERE "id" IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002')`,
    );

    await queryRunner.query(`ALTER TABLE "skus" ADD COLUMN "active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(
      `ALTER TABLE "skus" ADD COLUMN "embedding_status" text NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(`ALTER TABLE "skus" ADD COLUMN "embedding_error" text`);
    await queryRunner.query(
      `ALTER TABLE "skus" ADD CONSTRAINT "skus_embedding_status_check" CHECK ("embedding_status" IN ('ready', 'pending', 'unavailable'))`,
    );
    await queryRunner.query(
      `UPDATE "skus" SET "embedding_status" = CASE WHEN "embedding" IS NULL THEN 'unavailable' ELSE 'ready' END`,
    );
    await queryRunner.query(`CREATE INDEX "skus_org_active_idx" ON "skus" ("org_id", "active")`);

    await queryRunner.query(`ALTER TABLE "quotes" ADD COLUMN "email_sent_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "quotes" ADD COLUMN "email_recipient" text`);
    await queryRunner.query(`ALTER TABLE "quotes" ADD COLUMN "email_provider_message_id" text`);
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN "email_delivery_started_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP COLUMN IF EXISTS "email_delivery_started_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP COLUMN IF EXISTS "email_provider_message_id"`,
    );
    await queryRunner.query(`ALTER TABLE "quotes" DROP COLUMN IF EXISTS "email_recipient"`);
    await queryRunner.query(`ALTER TABLE "quotes" DROP COLUMN IF EXISTS "email_sent_at"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "skus_org_active_idx"`);
    await queryRunner.query(
      `ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_embedding_status_check"`,
    );
    await queryRunner.query(`ALTER TABLE "skus" DROP COLUMN IF EXISTS "embedding_error"`);
    await queryRunner.query(`ALTER TABLE "skus" DROP COLUMN IF EXISTS "embedding_status"`);
    await queryRunner.query(`ALTER TABLE "skus" DROP COLUMN IF EXISTS "active"`);

    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "demo_enabled"`);
  }
}
