import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStratosAvacFoundation1782570000000 implements MigrationInterface {
  name = 'AddStratosAvacFoundation1782570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."pricing_rule_type_v2" AS ENUM(
        'margin_floor', 'max_discount', 'qty_break', 'lead_time', 'catalog_unit',
        'included_allowance', 'conditional_surcharge', 'fixed_adder', 'labor_hours',
        'margin_markup', 'tax'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "pricing_rules" ALTER COLUMN "rule_type" TYPE "public"."pricing_rule_type_v2"
      USING "rule_type"::text::"public"."pricing_rule_type_v2"
    `);
    await queryRunner.query(`DROP TYPE "public"."pricing_rule_type"`);
    await queryRunner.query(
      `ALTER TYPE "public"."pricing_rule_type_v2" RENAME TO "pricing_rule_type"`,
    );

    await queryRunner.query(`ALTER TABLE "pricing_rules" ADD COLUMN "vertical" text`);
    await queryRunner.query(`ALTER TABLE "pricing_rules" ADD COLUMN "rule_key" text`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rules" ADD COLUMN "sort_order" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`
      ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_vertical_check"
      CHECK ("vertical" IS NULL OR "vertical" IN ('avac', 'caixilharia'))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "pricing_rules_org_rule_key_unique"
      ON "pricing_rules" ("org_id", "rule_key") WHERE "rule_key" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "quote_line_items" ADD COLUMN "kind" text NOT NULL DEFAULT 'equipment'
    `);
    await queryRunner.query(`
      ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_kind_check"
      CHECK ("kind" IN ('equipment', 'material', 'labor', 'consumable', 'margin', 'tax'))
    `);

    await queryRunner.query(`
      CREATE TABLE "org_branding" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "org_id" uuid NOT NULL,
        "company_name" text NOT NULL,
        "logo_url" text,
        "primary_color" text NOT NULL DEFAULT '#5eead4',
        "vat_number" text,
        "address" text,
        "footer_text" text,
        "iva_rate" numeric(5,4) NOT NULL DEFAULT 0.23,
        "email" text,
        "phone" text,
        "quote_validity_days" integer NOT NULL DEFAULT 30,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "org_branding_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "org_branding_org_unique" UNIQUE ("org_id"),
        CONSTRAINT "org_branding_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "org_branding_primary_color_check" CHECK ("primary_color" ~ '^#[0-9A-Fa-f]{6}$'),
        CONSTRAINT "org_branding_iva_rate_check" CHECK ("iva_rate" BETWEEN 0 AND 1),
        CONSTRAINT "org_branding_validity_check" CHECK ("quote_validity_days" BETWEEN 1 AND 365)
      )
    `);
    await queryRunner.query(`ALTER TABLE "org_branding" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "org_branding" FORCE ROW LEVEL SECURITY`);
    for (const operation of ['select', 'insert', 'update', 'delete']) {
      const command = operation.toUpperCase();
      const check = operation === 'insert' ? 'WITH CHECK' : 'USING';
      await queryRunner.query(`
        CREATE POLICY ${operation}_by_org ON "org_branding" FOR ${command}
        ${check} (org_id = current_setting('app.org_id', true)::uuid)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "org_branding"`);
    await queryRunner.query(
      `ALTER TABLE "quote_line_items" DROP CONSTRAINT IF EXISTS "quote_line_items_kind_check"`,
    );
    await queryRunner.query(`ALTER TABLE "quote_line_items" DROP COLUMN IF EXISTS "kind"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "pricing_rules_org_rule_key_unique"`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rules" DROP CONSTRAINT IF EXISTS "pricing_rules_vertical_check"`,
    );
    await queryRunner.query(`ALTER TABLE "pricing_rules" DROP COLUMN IF EXISTS "sort_order"`);
    await queryRunner.query(`ALTER TABLE "pricing_rules" DROP COLUMN IF EXISTS "rule_key"`);
    await queryRunner.query(`ALTER TABLE "pricing_rules" DROP COLUMN IF EXISTS "vertical"`);
    await queryRunner.query(
      `CREATE TYPE "public"."pricing_rule_type_v1" AS ENUM('margin_floor', 'max_discount', 'qty_break', 'lead_time')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rules" ALTER COLUMN "rule_type" TYPE "public"."pricing_rule_type_v1" USING "rule_type"::text::"public"."pricing_rule_type_v1"`,
    );
    await queryRunner.query(`DROP TYPE "public"."pricing_rule_type"`);
    await queryRunner.query(
      `ALTER TYPE "public"."pricing_rule_type_v1" RENAME TO "pricing_rule_type"`,
    );
  }
}
