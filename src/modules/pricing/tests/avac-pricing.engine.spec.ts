import { describe, expect, it } from 'vitest';
import type { Sku } from '@modules/catalog/entities/sku.entity';
import type { AvacExtractionV1 } from '@modules/extraction/schemas/extraction-v1.schema';
import type { PricingRule } from '../entities/pricing-rule.entity';
import { PricingRuleType } from '../enums/pricing-rule-type.enum';
import { priceAvacQuote } from '../avac-pricing.engine';

const extraction: AvacExtractionV1 = {
  vertical: 'avac',
  customer: { name: 'João Martins', email: null, phone: null, address: null },
  avac: {
    system_type: 'multi-split',
    brand_preference: 'Daikin',
    areas: [
      { room: 'sala', area_m2: 35 },
      { room: 'quarto', area_m2: 14 },
      { room: 'quarto', area_m2: 14 },
    ],
    indoor_units_requested: null,
    pipe_length_m: 6,
    install_height_m: null,
    wall_type: null,
    outdoor_unit_distance_m: 6,
    needs_electrical_panel: null,
    distance_km: null,
    install_type: 'standard',
    notes: '',
  },
  missing_info: [],
  confidence: 'high',
};

const skus = [
  sku('sku-25', 'DAIKIN-FTXM25', 'Daikin FTXM25', 90000),
  sku('sku-35', 'DAIKIN-FTXM35', 'Daikin FTXM35', 110000),
  sku('sku-out', 'DAIKIN-OUTDOOR-4', 'Daikin Multi+ exterior', 180000),
];

const rules = [
  rule(PricingRuleType.CATALOG_UNIT, 'indoor', {
    role: 'indoor_unit',
    selections: [
      { max_area_m2: 25, sku_code: 'DAIKIN-FTXM25' },
      { max_area_m2: null, sku_code: 'DAIKIN-FTXM35' },
    ],
    default_sku_code: 'DAIKIN-FTXM25',
  }),
  rule(PricingRuleType.CATALOG_UNIT, 'outdoor', {
    role: 'outdoor_unit',
    sku_code: 'DAIKIN-OUTDOOR-4',
    max_indoor_units: 4,
  }),
  rule(PricingRuleType.INCLUDED_ALLOWANCE, 'pipe', {
    variable: 'pipe_length_m',
    included: 3,
    unit_price_minor: 1450,
    description: 'Tubagem adicional',
    kind: 'material',
  }),
  rule(PricingRuleType.INCLUDED_ALLOWANCE, 'distance', {
    variable: 'outdoor_unit_distance_m',
    included: 5,
    unit_price_minor: 1800,
    description: 'Distância adicional',
    kind: 'material',
  }),
  rule(PricingRuleType.LABOR_HOURS, 'labor', {
    rate_minor: 3000,
    hours_by_unit_count: { '3': 12 },
    description: 'Instalação',
  }),
  rule(PricingRuleType.MARGIN_MARKUP, 'margin', { percentage: 32 }),
  rule(PricingRuleType.TAX, 'tax', { percentage: 23 }),
];

describe('priceAvacQuote', () => {
  it('golden AVAC-01: returns the exact deterministic total and explicit line kinds', () => {
    const result = priceAvacQuote(extraction, rules, skus);

    expect(result.blocked).toBe(false);
    expect(result.discountMinor).toBe(0);
    expect(result.subtotalMinor).toBe(676038);
    expect(result.taxMinor).toBe(155489);
    expect(result.totalMinor).toBe(831527);
    expect(result.currency).toBe('EUR');
    expect(result.lines.map((line) => line.kind)).toEqual([
      'equipment',
      'equipment',
      'equipment',
      'material',
      'material',
      'labor',
      'margin',
      'tax',
    ]);
    expect(result.lines.map((line) => line.amountMinor)).toEqual([
      110000, 180000, 180000, 4350, 1800, 36000, 163888, 155489,
    ]);
  });

  it('fails closed when no room or explicit indoor-unit count exists', () => {
    const result = priceAvacQuote(
      { ...extraction, avac: { ...extraction.avac, areas: [], indoor_units_requested: null } },
      rules,
      skus,
    );

    expect(result.blocked).toBe(true);
    expect(result.missingRules).toContain('critical_input.indoor_units_or_areas');
  });

  it('changes tax from the organization-owned branding rate without code changes', () => {
    const result = priceAvacQuote(extraction, rules, skus, { taxRate: 0.06 });

    expect(result.subtotalMinor).toBe(676038);
    expect(result.taxMinor).toBe(40562);
    expect(result.totalMinor).toBe(716600);
  });

  it('fails closed when a selected catalog SKU is not denominated in EUR', () => {
    const nonEuroSkus = skus.map((item) => ({ ...item, currency: 'NGN' }) as Sku);

    const result = priceAvacQuote(extraction, rules, nonEuroSkus);

    expect(result.blocked).toBe(true);
    expect(result.missingRules).toContain('catalog.currency_must_be_eur');
    expect(result.currency).toBe('EUR');
  });
});

function sku(id: string, code: string, name: string, price: number): Sku {
  return {
    id,
    org_id: 'org-1',
    sku_code: code,
    name,
    base_price_minor: price,
    cost_minor: Math.round(price * 0.7),
    currency: 'EUR',
    lead_time_days: 5,
  } as Sku;
}

function rule(type: PricingRuleType, key: string, config: Record<string, unknown>): PricingRule {
  return {
    id: key,
    org_id: 'org-1',
    rule_type: type,
    vertical: 'avac',
    rule_key: key,
    sort_order: 0,
    config,
    active: true,
  } as PricingRule;
}
