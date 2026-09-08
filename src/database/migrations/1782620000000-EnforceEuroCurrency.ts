import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes EUR an invariant instead of a presentation default.
 *
 * The old upstream seed used NGN. Those rows are disposable demo fixtures, so they are removed
 * rather than falsely relabelled as euros. A non-demo tenant with non-EUR money makes the
 * migration fail closed: real monetary values require an explicit archival/conversion policy.
 */
export class EnforceEuroCurrency1782620000000 implements MigrationInterface {
  name = 'EnforceEuroCurrency1782620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "skus" s
          JOIN "organizations" o ON o."id" = s."org_id"
          WHERE s."currency" <> 'EUR' AND o."demo_enabled" = false
        ) OR EXISTS (
          SELECT 1 FROM "quotes" q
          JOIN "organizations" o ON o."id" = q."org_id"
          WHERE q."currency" <> 'EUR' AND o."demo_enabled" = false
        ) THEN
          RAISE EXCEPTION 'Non-EUR production data requires an explicit archival or conversion policy';
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DELETE FROM "quote_line_items"
      WHERE "quote_id" IN (
        SELECT q."id" FROM "quotes" q
        JOIN "organizations" o ON o."id" = q."org_id"
        WHERE q."currency" <> 'EUR' AND o."demo_enabled" = true
      )
    `);
    await queryRunner.query(`
      DELETE FROM "quotes"
      USING "organizations" o
      WHERE "quotes"."org_id" = o."id"
        AND "quotes"."currency" <> 'EUR'
        AND o."demo_enabled" = true
    `);

    await queryRunner.query(`
      DELETE FROM "candidate_matches"
      WHERE "sku_id" IN (
        SELECT s."id" FROM "skus" s
        JOIN "organizations" o ON o."id" = s."org_id"
        WHERE s."currency" <> 'EUR' AND o."demo_enabled" = true
      )
    `);
    await queryRunner.query(`
      UPDATE "line_items"
      SET "matched_sku_id" = NULL,
          "match_confidence" = NULL,
          "match_method" = NULL,
          "unit_price_minor" = NULL,
          "lead_time_days" = NULL
      WHERE "matched_sku_id" IN (
        SELECT s."id" FROM "skus" s
        JOIN "organizations" o ON o."id" = s."org_id"
        WHERE s."currency" <> 'EUR' AND o."demo_enabled" = true
      )
    `);
    await queryRunner.query(`
      DELETE FROM "skus"
      USING "organizations" o
      WHERE "skus"."org_id" = o."id"
        AND "skus"."currency" <> 'EUR'
        AND o."demo_enabled" = true
    `);

    await queryRunner.query(`ALTER TABLE "skus" ALTER COLUMN "currency" SET DEFAULT 'EUR'`);
    await queryRunner.query(`ALTER TABLE "quotes" ALTER COLUMN "currency" SET DEFAULT 'EUR'`);
    await queryRunner.query(
      `ALTER TABLE "skus" ADD CONSTRAINT "skus_currency_eur_check" CHECK ("currency" = 'EUR') NOT VALID`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD CONSTRAINT "quotes_currency_eur_check" CHECK ("currency" = 'EUR') NOT VALID`,
    );
    await queryRunner.query(`ALTER TABLE "skus" VALIDATE CONSTRAINT "skus_currency_eur_check"`);
    await queryRunner.query(`ALTER TABLE "quotes" VALIDATE CONSTRAINT "quotes_currency_eur_check"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_currency_eur_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "skus" DROP CONSTRAINT IF EXISTS "skus_currency_eur_check"`,
    );
    // Keep the safe default; removed upstream demo fixtures are intentionally not recreated.
    await queryRunner.query(`ALTER TABLE "quotes" ALTER COLUMN "currency" SET DEFAULT 'EUR'`);
    await queryRunner.query(`ALTER TABLE "skus" ALTER COLUMN "currency" SET DEFAULT 'EUR'`);
  }
}
