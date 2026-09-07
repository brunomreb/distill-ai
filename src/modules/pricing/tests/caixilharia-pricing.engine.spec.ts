import { describe, expect, it } from 'vitest';
import type { Sku } from '@modules/catalog/entities/sku.entity';
import type { CaixilhariaExtractionV1 } from '@modules/extraction/schemas/extraction-v1.schema';
import type { PricingRule } from '../entities/pricing-rule.entity';
import { PricingRuleType } from '../enums/pricing-rule-type.enum';
import { priceCaixilhariaQuote } from '../caixilharia-pricing.engine';

const extraction: CaixilhariaExtractionV1 = {
  vertical: 'caixilharia',
  customer: {
    name: 'Ana Sousa',
    email: 'ana.sousa@example.com',
    phone: '+351 912 345 678',
    address: null,
  },
  caixilharia: {
    openings: [
      {
        ref: 'J1',
        location: 'sala',
        width_mm: 1200,
        height_mm: 1400,
        opening_type: 'oscilo-batente',
        profile_preference: 'PVC 70 mm branco',
        glass_preference: 'vidro duplo low-e',
        finish: 'branco',
        hardware: null,
        blind: true,
        insect_screen: true,
        quantity: 2,
      },
      {
        ref: 'P1',
        location: 'terraço',
        width_mm: 1800,
        height_mm: 2100,
        opening_type: 'correr',
        profile_preference: 'alumínio RPT antracite',
        glass_preference: 'vidro duplo low-e',
        finish: 'antracite',
        hardware: null,
        blind: false,
        insect_screen: false,
        quantity: 1,
      },
    ],
    remove_existing: true,
    floor: 2,
    distance_km: 18,
    notes: '',
  },
  missing_info: [],
  confidence: 'high',
};

const skus = [
  sku('pvc', 'CAIX-PVC-70', 'Perfil PVC 70 mm', 18500),
  sku('alu', 'CAIX-ALU-RPT', 'Perfil alumínio RPT', 26000),
  sku('glass', 'CAIX-VIDRO-LOWE', 'Vidro duplo 4-16-4 low-e', 9500),
  sku('oscilo', 'CAIX-FERR-OSCILO', 'Ferragem oscilo-batente', 8500),
  sku('correr', 'CAIX-FERR-CORRER', 'Ferragem de correr', 12000),
  sku('batente', 'CAIX-FERR-BATENTE', 'Ferragem de batente', 6500),
  sku('blind', 'CAIX-PERSIANA', 'Persiana térmica', 11000),
  sku('screen', 'CAIX-MOSQUITEIRO', 'Mosquiteiro', 7500),
  sku('labor', 'CAIX-MONTAGEM', 'Montagem por vão', 9000),
  sku('travel', 'CAIX-TRANSPORTE', 'Transporte e deslocação', 75),
];

const rules = [
  rule(PricingRuleType.CATALOG_UNIT, 'profile', {
    role: 'profile',
    selections: [
      { keywords: ['pvc', '70 mm'], sku_code: 'CAIX-PVC-70' },
      { keywords: ['alumínio', 'aluminio', 'rpt'], sku_code: 'CAIX-ALU-RPT' },
    ],
    default_sku_code: 'CAIX-PVC-70',
    opening_type_multipliers: {
      fixo: 0.85,
      batente: 1,
      'oscilo-batente': 1.15,
      correr: 1.1,
    },
  }),
  rule(PricingRuleType.CATALOG_UNIT, 'glass', {
    role: 'glass',
    selections: [{ keywords: ['low-e', 'vidro duplo'], sku_code: 'CAIX-VIDRO-LOWE' }],
    default_sku_code: 'CAIX-VIDRO-LOWE',
  }),
  rule(PricingRuleType.CATALOG_UNIT, 'hardware', {
    role: 'hardware',
    sku_by_opening_type: {
      batente: 'CAIX-FERR-BATENTE',
      'oscilo-batente': 'CAIX-FERR-OSCILO',
      correr: 'CAIX-FERR-CORRER',
    },
  }),
  rule(PricingRuleType.CATALOG_UNIT, 'blind', {
    role: 'blind',
    sku_code: 'CAIX-PERSIANA',
  }),
  rule(PricingRuleType.CATALOG_UNIT, 'screen', {
    role: 'insect_screen',
    sku_code: 'CAIX-MOSQUITEIRO',
  }),
  rule(PricingRuleType.FIXED_ADDER, 'minimum-area', {
    role: 'minimum_billable_area',
    area_m2: 0.5,
  }),
  rule(PricingRuleType.FIXED_ADDER, 'removal', {
    role: 'remove_existing',
    amount_minor_per_opening: 4000,
    description: 'Remoção da caixilharia existente',
  }),
  rule(PricingRuleType.CONDITIONAL_SURCHARGE, 'transport', {
    role: 'transport_per_km',
    sku_code: 'CAIX-TRANSPORTE',
    included_km: 0,
  }),
  rule(PricingRuleType.LABOR_HOURS, 'labor', {
    role: 'installation_per_opening',
    sku_code: 'CAIX-MONTAGEM',
  }),
  rule(PricingRuleType.QTY_BREAK, 'discount', {
    role: 'area_discount',
    thresholds: [
      { over_area_m2: 15, percentage: 4 },
      { over_area_m2: 30, percentage: 7 },
    ],
  }),
  rule(PricingRuleType.MARGIN_MARKUP, 'margin', { percentage: 25 }),
  rule(PricingRuleType.TAX, 'tax', { percentage: 23 }),
];

describe('priceCaixilhariaQuote', () => {
  it('golden CAIX-01: calculates every area, line and total deterministically', () => {
    const result = priceCaixilhariaQuote(extraction, rules, skus);

    expect(result.blocked).toBe(false);
    expect(result.totalAreaM2).toBe(7.14);
    expect(result.discountMinor).toBe(0);
    expect(result.subtotalMinor).toBe(460915);
    expect(result.taxMinor).toBe(106010);
    expect(result.totalMinor).toBe(566925);
    expect(result.currency).toBe('EUR');
    expect(result.lines.map((line) => line.kind)).toEqual([
      'material',
      'material',
      'equipment',
      'material',
      'equipment',
      'material',
      'material',
      'equipment',
      'labor',
      'labor',
      'labor',
      'margin',
      'tax',
    ]);
    expect(result.lines.map((line) => line.amountMinor)).toEqual([
      71484, 31920, 17000, 36960, 15000, 108108, 35910, 12000, 27000, 12000, 1350, 92183, 106010,
    ]);
  });

  it('uses the minimum billable area per opening without changing the real area total', () => {
    const tiny = {
      ...extraction,
      caixilharia: {
        ...extraction.caixilharia,
        openings: [
          {
            ...extraction.caixilharia.openings[0],
            width_mm: 400,
            height_mm: 400,
            quantity: 2,
          },
        ],
        remove_existing: false,
        distance_km: null,
      },
    };

    const result = priceCaixilhariaQuote(tiny, rules, skus);

    expect(result.totalAreaM2).toBe(0.32);
    expect(result.lines[0].quantity).toBe(1);
    expect(result.lines[1].quantity).toBe(1);
  });

  it('applies the configured 4% and 7% total-area tiers only above their thresholds', () => {
    const fourPercent = priceCaixilhariaQuote(
      {
        ...extraction,
        caixilharia: {
          ...extraction.caixilharia,
          openings: [{ ...extraction.caixilharia.openings[0], quantity: 10 }],
        },
      },
      rules,
      skus,
    );
    const sevenPercent = priceCaixilhariaQuote(
      {
        ...extraction,
        caixilharia: {
          ...extraction.caixilharia,
          openings: [{ ...extraction.caixilharia.openings[0], quantity: 20 }],
        },
      },
      rules,
      skus,
    );

    expect(fourPercent.totalAreaM2).toBe(16.8);
    expect(fourPercent.discountMinor).toBe(Math.round(fourPercent.subtotalMinor * 0.04));
    expect(sevenPercent.totalAreaM2).toBe(33.6);
    expect(sevenPercent.discountMinor).toBe(Math.round(sevenPercent.subtotalMinor * 0.07));
  });

  it('fails closed when a critical dimension is absent', () => {
    const result = priceCaixilhariaQuote(
      {
        ...extraction,
        caixilharia: {
          ...extraction.caixilharia,
          openings: [{ ...extraction.caixilharia.openings[0], width_mm: null }],
        },
      },
      rules,
      skus,
    );

    expect(result.blocked).toBe(true);
    expect(result.missingRules).toContain('critical_input.openings.J1.width_mm');
  });

  it('does not require a hardware SKU for a fixed pane', () => {
    const result = priceCaixilhariaQuote(
      {
        ...extraction,
        caixilharia: {
          ...extraction.caixilharia,
          openings: [
            {
              ...extraction.caixilharia.openings[0],
              opening_type: 'fixo',
              blind: false,
              insect_screen: false,
            },
          ],
          remove_existing: false,
          distance_km: null,
        },
      },
      rules,
      skus,
    );

    expect(result.blocked).toBe(false);
    expect(result.lines.some((line) => line.description.includes('Ferragem'))).toBe(false);
  });

  it('uses the organization IVA rate rather than a hardcoded percentage', () => {
    const result = priceCaixilhariaQuote(extraction, rules, skus, { taxRate: 0.06 });

    expect(result.taxMinor).toBe(27655);
    expect(result.totalMinor).toBe(488570);
  });
});

function sku(id: string, code: string, name: string, price: number): Sku {
  return {
    id,
    org_id: 'org-caix',
    sku_code: code,
    name,
    base_price_minor: price,
    cost_minor: Math.round(price * 0.7),
    currency: 'EUR',
    lead_time_days: 12,
  } as Sku;
}

function rule(type: PricingRuleType, key: string, config: Record<string, unknown>): PricingRule {
  return {
    id: key,
    org_id: 'org-caix',
    rule_type: type,
    vertical: 'caixilharia',
    rule_key: `caixilharia.${key}`,
    sort_order: 0,
    config,
    active: true,
  } as PricingRule;
}
