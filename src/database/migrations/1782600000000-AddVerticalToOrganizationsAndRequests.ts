import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerticalToOrganizationsAndRequests1782600000000 implements MigrationInterface {
  name = 'AddVerticalToOrganizationsAndRequests1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD COLUMN "vertical" text NOT NULL DEFAULT 'avac'`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD CONSTRAINT "organizations_vertical_check" CHECK ("vertical" IN ('avac', 'caixilharia'))`,
    );
    await queryRunner.query(`ALTER TABLE "requests" ADD COLUMN "vertical" text`);
    await queryRunner.query(
      `ALTER TABLE "requests" ADD CONSTRAINT "requests_vertical_check" CHECK ("vertical" IS NULL OR "vertical" IN ('avac', 'caixilharia'))`,
    );
    await queryRunner.query(
      `UPDATE "organizations" SET "vertical" = 'caixilharia' WHERE "id" = '00000000-0000-0000-0000-000000000002'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requests" DROP CONSTRAINT IF EXISTS "requests_vertical_check"`,
    );
    await queryRunner.query(`ALTER TABLE "requests" DROP COLUMN IF EXISTS "vertical"`);
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_vertical_check"`,
    );
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "vertical"`);
  }
}
