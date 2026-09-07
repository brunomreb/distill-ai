import { MigrationInterface, QueryRunner } from 'typeorm';

const ORG_ID = '00000000-0000-0000-0000-000000000000';

const SKUS = [
  [
    '10000000-0000-0000-0000-000000000025',
    'DAIKIN-FTXM25',
    'Daikin Perfera FTXM25 — unidade interior',
    90000,
    63000,
  ],
  [
    '10000000-0000-0000-0000-000000000035',
    'DAIKIN-FTXM35',
    'Daikin Perfera FTXM35 — unidade interior',
    110000,
    77000,
  ],
  [
    '10000000-0000-0000-0000-000000000104',
    'DAIKIN-OUTDOOR-4',
    'Daikin Multi+ — unidade exterior até 4 divisões',
    180000,
    126000,
  ],
] as const;

const RULES: ReadonlyArray<readonly [string, string, string, Record<string, unknown>, number]> = [
  [
    '20000000-0000-0000-0000-000000000001',
    'avac.indoor.selection',
    'catalog_unit',
    {
      role: 'indoor_unit',
      selections: [
        { max_area_m2: 25, sku_code: 'DAIKIN-FTXM25' },
        { max_area_m2: null, sku_code: 'DAIKIN-FTXM35' },
      ],
      default_sku_code: 'DAIKIN-FTXM25',
    },
    10,
  ],
  [
    '20000000-0000-0000-0000-000000000002',
    'avac.outdoor.selection',
    'catalog_unit',
    { role: 'outdoor_unit', sku_code: 'DAIKIN-OUTDOOR-4', max_indoor_units: 4 },
    20,
  ],
  [
    '20000000-0000-0000-0000-000000000003',
    'avac.pipe.allowance',
    'included_allowance',
    {
      variable: 'pipe_length_m',
      included: 3,
      unit_price_minor: 1450,
      description: 'Tubagem adicional',
      kind: 'material',
    },
    30,
  ],
  [
    '20000000-0000-0000-0000-000000000004',
    'avac.outdoor-distance.allowance',
    'included_allowance',
    {
      variable: 'outdoor_unit_distance_m',
      included: 5,
      unit_price_minor: 1800,
      description: 'Distância adicional à unidade exterior',
      kind: 'material',
    },
    40,
  ],
  [
    '20000000-0000-0000-0000-000000000005',
    'avac.height.surcharge',
    'conditional_surcharge',
    {
      variable: 'install_height_m',
      operator: 'gt',
      value: 3,
      amount_minor: 5000,
      description: 'Trabalho em altura superior a 3 m',
      kind: 'labor',
    },
    50,
  ],
  [
    '20000000-0000-0000-0000-000000000006',
    'avac.concrete.surcharge',
    'conditional_surcharge',
    {
      variable: 'wall_type',
      operator: 'eq',
      value: 'betao',
      amount_minor: 3500,
      description: 'Perfuração em betão',
      kind: 'labor',
    },
    60,
  ],
  [
    '20000000-0000-0000-0000-000000000007',
    'avac.travel.surcharge',
    'conditional_surcharge',
    {
      variable: 'distance_km',
      operator: 'gt',
      value: 30,
      amount_minor: 2500,
      description: 'Deslocação fora da zona incluída',
      kind: 'labor',
    },
    70,
  ],
  [
    '20000000-0000-0000-0000-000000000008',
    'avac.panel.adder',
    'fixed_adder',
    {
      variable: 'needs_electrical_panel',
      when: true,
      amount_minor: 12000,
      description: 'Adequação do quadro elétrico',
      kind: 'material',
    },
    80,
  ],
  [
    '20000000-0000-0000-0000-000000000009',
    'avac.installation.labor',
    'labor_hours',
    {
      rate_minor: 3000,
      hours_by_unit_count: { '1': 5, '2': 8, '3': 12, '4': 15 },
      description: 'Instalação e colocação em serviço',
    },
    90,
  ],
  [
    '20000000-0000-0000-0000-000000000010',
    'avac.margin',
    'margin_markup',
    { percentage: 32, description: 'Margem comercial' },
    100,
  ],
  [
    '20000000-0000-0000-0000-000000000011',
    'avac.iva',
    'tax',
    { percentage: 23, label: 'IVA' },
    110,
  ],
];

export class SeedAvacDemo1782580000000 implements MigrationInterface {
  name = 'SeedAvacDemo1782580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [id, skuCode, name, price, cost] of SKUS) {
      await queryRunner.query(
        `INSERT INTO "skus" ("id", "org_id", "sku_code", "name", "description", "attributes", "base_price_minor", "cost_minor", "currency", "lead_time_days", "created_at", "updated_at")
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'EUR', 5, now(), now())
         ON CONFLICT ("org_id", "sku_code") DO UPDATE SET
           "name" = EXCLUDED."name", "description" = EXCLUDED."description",
           "attributes" = EXCLUDED."attributes", "base_price_minor" = EXCLUDED."base_price_minor",
           "cost_minor" = EXCLUDED."cost_minor", "currency" = 'EUR', "updated_at" = now()`,
        [
          id,
          ORG_ID,
          skuCode,
          name,
          'Equipamento AVAC do catálogo demo',
          JSON.stringify({ vertical: 'avac', brand: 'Daikin' }),
          price,
          cost,
        ],
      );
    }

    for (const [id, key, type, config, order] of RULES) {
      await queryRunner.query(
        `INSERT INTO "pricing_rules" ("id", "org_id", "rule_type", "vertical", "rule_key", "sort_order", "config", "active", "created_at", "updated_at")
         VALUES ($1, $2, $3::pricing_rule_type, 'avac', $4, $5, $6::jsonb, true, now(), now())
         ON CONFLICT ("org_id", "rule_key") WHERE "rule_key" IS NOT NULL DO UPDATE SET
           "rule_type" = EXCLUDED."rule_type", "sort_order" = EXCLUDED."sort_order",
           "config" = EXCLUDED."config", "active" = true, "updated_at" = now()`,
        [id, ORG_ID, type, key, order, JSON.stringify(config)],
      );
    }

    await queryRunner.query(
      `INSERT INTO "org_branding" ("org_id", "company_name", "primary_color", "vat_number", "address", "footer_text", "iva_rate", "email", "phone", "quote_validity_days")
       VALUES ($1, 'Clima Atlântico', '#5eead4', 'PT509999990', 'Rua da Empresa 10, 9000-000 Funchal', 'Instalação por técnicos certificados. Equipamento sujeito a disponibilidade.', 0.23, 'orcamentos@clima-atlantico.pt', '+351 291 000 000', 30)
       ON CONFLICT ("org_id") DO UPDATE SET
         "company_name" = EXCLUDED."company_name", "primary_color" = EXCLUDED."primary_color",
         "vat_number" = EXCLUDED."vat_number", "address" = EXCLUDED."address",
         "footer_text" = EXCLUDED."footer_text", "iva_rate" = EXCLUDED."iva_rate",
         "email" = EXCLUDED."email", "phone" = EXCLUDED."phone",
         "quote_validity_days" = EXCLUDED."quote_validity_days", "updated_at" = now()`,
      [ORG_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "pricing_rules" WHERE "org_id" = $1 AND "rule_key" LIKE 'avac.%'`,
      [ORG_ID],
    );
    await queryRunner.query(
      `DELETE FROM "skus" WHERE "org_id" = $1 AND "sku_code" LIKE 'DAIKIN-%'`,
      [ORG_ID],
    );
    await queryRunner.query(`DELETE FROM "org_branding" WHERE "org_id" = $1`, [ORG_ID]);
  }
}
