import { MigrationInterface, QueryRunner } from 'typeorm';

const ORG_ID = '00000000-0000-0000-0000-000000000002';

const SKUS = [
  ['31000000-0000-0000-0000-000000000001', 'CAIX-PVC-70', 'Perfil PVC 70 mm', 18500, 12950, 'm²'],
  [
    '31000000-0000-0000-0000-000000000002',
    'CAIX-ALU-RPT',
    'Perfil alumínio RPT',
    26000,
    18200,
    'm²',
  ],
  [
    '31000000-0000-0000-0000-000000000003',
    'CAIX-VIDRO-LOWE',
    'Vidro duplo 4-16-4 low-e',
    9500,
    6650,
    'm²',
  ],
  [
    '31000000-0000-0000-0000-000000000004',
    'CAIX-FERR-OSCILO',
    'Ferragem oscilo-batente',
    8500,
    5950,
    'un',
  ],
  [
    '31000000-0000-0000-0000-000000000005',
    'CAIX-FERR-CORRER',
    'Ferragem de correr',
    12000,
    8400,
    'un',
  ],
  [
    '31000000-0000-0000-0000-000000000006',
    'CAIX-FERR-BATENTE',
    'Ferragem de batente',
    6500,
    4550,
    'un',
  ],
  ['31000000-0000-0000-0000-000000000007', 'CAIX-PERSIANA', 'Persiana térmica', 11000, 7700, 'm²'],
  ['31000000-0000-0000-0000-000000000008', 'CAIX-MOSQUITEIRO', 'Mosquiteiro', 7500, 5250, 'un'],
  ['31000000-0000-0000-0000-000000000009', 'CAIX-MONTAGEM', 'Montagem por vão', 9000, 6300, 'vão'],
  [
    '31000000-0000-0000-0000-000000000010',
    'CAIX-TRANSPORTE',
    'Transporte e deslocação',
    75,
    50,
    'km',
  ],
] as const;

const RULES: ReadonlyArray<readonly [string, string, string, Record<string, unknown>, number]> = [
  [
    '32000000-0000-0000-0000-000000000001',
    'caixilharia.profile',
    'catalog_unit',
    {
      role: 'profile',
      selections: [
        { keywords: ['pvc', '70 mm', '70mm'], sku_code: 'CAIX-PVC-70' },
        { keywords: ['aluminio', 'alumínio', 'rpt'], sku_code: 'CAIX-ALU-RPT' },
      ],
      default_sku_code: 'CAIX-PVC-70',
      opening_type_multipliers: {
        fixo: 0.85,
        batente: 1,
        'oscilo-batente': 1.15,
        correr: 1.1,
      },
    },
    10,
  ],
  [
    '32000000-0000-0000-0000-000000000002',
    'caixilharia.glass',
    'catalog_unit',
    {
      role: 'glass',
      selections: [
        {
          keywords: ['vidro duplo', 'low-e', 'low e', '4-16-4'],
          sku_code: 'CAIX-VIDRO-LOWE',
        },
      ],
      default_sku_code: 'CAIX-VIDRO-LOWE',
    },
    20,
  ],
  [
    '32000000-0000-0000-0000-000000000003',
    'caixilharia.hardware',
    'catalog_unit',
    {
      role: 'hardware',
      sku_by_opening_type: {
        batente: 'CAIX-FERR-BATENTE',
        'oscilo-batente': 'CAIX-FERR-OSCILO',
        correr: 'CAIX-FERR-CORRER',
      },
    },
    30,
  ],
  [
    '32000000-0000-0000-0000-000000000004',
    'caixilharia.blind',
    'catalog_unit',
    { role: 'blind', sku_code: 'CAIX-PERSIANA' },
    40,
  ],
  [
    '32000000-0000-0000-0000-000000000005',
    'caixilharia.insect-screen',
    'catalog_unit',
    { role: 'insect_screen', sku_code: 'CAIX-MOSQUITEIRO' },
    50,
  ],
  [
    '32000000-0000-0000-0000-000000000006',
    'caixilharia.minimum-billable-area',
    'fixed_adder',
    { role: 'minimum_billable_area', area_m2: 0.5 },
    60,
  ],
  [
    '32000000-0000-0000-0000-000000000007',
    'caixilharia.remove-existing',
    'fixed_adder',
    {
      role: 'remove_existing',
      amount_minor_per_opening: 4000,
      description: 'Remoção e encaminhamento da caixilharia existente',
    },
    70,
  ],
  [
    '32000000-0000-0000-0000-000000000008',
    'caixilharia.transport',
    'conditional_surcharge',
    { role: 'transport_per_km', sku_code: 'CAIX-TRANSPORTE', included_km: 0 },
    80,
  ],
  [
    '32000000-0000-0000-0000-000000000009',
    'caixilharia.installation.labor',
    'labor_hours',
    { role: 'installation_per_opening', sku_code: 'CAIX-MONTAGEM' },
    90,
  ],
  [
    '32000000-0000-0000-0000-000000000010',
    'caixilharia.area-discount',
    'qty_break',
    {
      role: 'area_discount',
      thresholds: [
        { over_area_m2: 15, percentage: 4 },
        { over_area_m2: 30, percentage: 7 },
      ],
    },
    100,
  ],
  [
    '32000000-0000-0000-0000-000000000011',
    'caixilharia.margin',
    'margin_markup',
    { percentage: 25, description: 'Margem comercial' },
    110,
  ],
  [
    '32000000-0000-0000-0000-000000000012',
    'caixilharia.iva',
    'tax',
    { percentage: 23, label: 'IVA' },
    120,
  ],
];

export class SeedCaixilhariaDemo1782590000000 implements MigrationInterface {
  name = 'SeedCaixilhariaDemo1782590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "organizations" ("id", "name", "created_at", "updated_at")
       VALUES ($1, 'Janelas Madeira Demo', now(), now())
       ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "updated_at" = now()`,
      [ORG_ID],
    );

    for (const [id, skuCode, name, price, cost, unit] of SKUS) {
      await queryRunner.query(
        `INSERT INTO "skus" ("id", "org_id", "sku_code", "name", "description", "attributes", "base_price_minor", "cost_minor", "currency", "lead_time_days", "created_at", "updated_at")
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'EUR', 12, now(), now())
         ON CONFLICT ("org_id", "sku_code") DO UPDATE SET
           "name" = EXCLUDED."name", "description" = EXCLUDED."description",
           "attributes" = EXCLUDED."attributes", "base_price_minor" = EXCLUDED."base_price_minor",
           "cost_minor" = EXCLUDED."cost_minor", "currency" = 'EUR', "updated_at" = now()`,
        [
          id,
          ORG_ID,
          skuCode,
          name,
          `Artigo de caixilharia faturado por ${unit}`,
          JSON.stringify({ vertical: 'caixilharia', unit }),
          price,
          cost,
        ],
      );
    }

    for (const [id, key, type, config, order] of RULES) {
      await queryRunner.query(
        `INSERT INTO "pricing_rules" ("id", "org_id", "rule_type", "vertical", "rule_key", "sort_order", "config", "active", "created_at", "updated_at")
         VALUES ($1, $2, $3::pricing_rule_type, 'caixilharia', $4, $5, $6::jsonb, true, now(), now())
         ON CONFLICT ("org_id", "rule_key") WHERE "rule_key" IS NOT NULL DO UPDATE SET
           "rule_type" = EXCLUDED."rule_type", "sort_order" = EXCLUDED."sort_order",
           "config" = EXCLUDED."config", "active" = true, "updated_at" = now()`,
        [id, ORG_ID, type, key, order, JSON.stringify(config)],
      );
    }

    await queryRunner.query(
      `INSERT INTO "org_branding" ("org_id", "company_name", "primary_color", "vat_number", "address", "footer_text", "iva_rate", "email", "phone", "quote_validity_days")
       VALUES ($1, 'Janelas Madeira', '#5eead4', 'PT509999992', 'Estrada Monumental 200, 9000-100 Funchal', 'Fabrico e montagem sujeitos a confirmação final das medidas em obra.', 0.23, 'orcamentos@janelasmadeira.pt', '+351 291 000 002', 30)
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
      `DELETE FROM "pricing_rules" WHERE "org_id" = $1 AND "rule_key" LIKE 'caixilharia.%'`,
      [ORG_ID],
    );
    await queryRunner.query(`DELETE FROM "skus" WHERE "org_id" = $1`, [ORG_ID]);
    await queryRunner.query(`DELETE FROM "org_branding" WHERE "org_id" = $1`, [ORG_ID]);
    await queryRunner.query(`DELETE FROM "organizations" WHERE "id" = $1`, [ORG_ID]);
  }
}
