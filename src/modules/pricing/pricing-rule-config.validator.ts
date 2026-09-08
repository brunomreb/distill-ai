import { z } from 'zod';
import { PricingRuleType } from './enums/pricing-rule-type.enum';

const kind = z.enum(['material', 'labor', 'consumable']);
const percentage = z.object({ percentage: z.number().min(0).max(100) }).passthrough();
const skuCode = z.string().trim().min(1);
const selection = z.object({ keywords: z.array(z.string().min(1)).min(1), sku_code: skuCode });

const schemas: Record<'avac' | 'caixilharia', Partial<Record<PricingRuleType, z.ZodType>>> = {
  avac: {
    [PricingRuleType.CATALOG_UNIT]: z.union([
      z.object({
        role: z.literal('indoor_unit'),
        selections: z
          .array(z.object({ max_area_m2: z.number().positive().nullable(), sku_code: skuCode }))
          .min(1),
        default_sku_code: skuCode,
      }),
      z.object({
        role: z.literal('outdoor_unit'),
        sku_code: skuCode,
        max_indoor_units: z.number().int().positive(),
      }),
    ]),
    [PricingRuleType.INCLUDED_ALLOWANCE]: z.object({
      variable: z.enum(['pipe_length_m', 'outdoor_unit_distance_m']),
      included: z.number().nonnegative(),
      unit_price_minor: z.number().int().nonnegative(),
      description: z.string().min(1),
      kind,
    }),
    [PricingRuleType.CONDITIONAL_SURCHARGE]: z.object({
      variable: z.enum(['install_height_m', 'wall_type', 'distance_km', 'install_type']),
      operator: z.enum(['eq', 'gt']),
      value: z.union([z.string(), z.number(), z.boolean()]),
      amount_minor: z.number().int().nonnegative(),
      description: z.string().min(1),
      kind,
    }),
    [PricingRuleType.FIXED_ADDER]: z.object({
      variable: z.literal('needs_electrical_panel'),
      when: z.boolean(),
      amount_minor: z.number().int().nonnegative(),
      description: z.string().min(1),
      kind,
    }),
    [PricingRuleType.LABOR_HOURS]: z.object({
      rate_minor: z.number().int().nonnegative(),
      hours_by_unit_count: z.record(z.string(), z.number().positive()),
      description: z.string().min(1),
    }),
    [PricingRuleType.MARGIN_MARKUP]: percentage,
    [PricingRuleType.TAX]: percentage,
  },
  caixilharia: {
    [PricingRuleType.CATALOG_UNIT]: z.union([
      z.object({
        role: z.literal('profile'),
        selections: z.array(selection).min(1),
        default_sku_code: skuCode,
        opening_type_multipliers: z.record(
          z.enum(['fixo', 'batente', 'oscilo-batente', 'correr']),
          z.number().positive(),
        ),
      }),
      z.object({
        role: z.literal('glass'),
        selections: z.array(selection).min(1),
        default_sku_code: skuCode,
      }),
      z.object({
        role: z.literal('hardware'),
        sku_by_opening_type: z.record(
          z.enum(['fixo', 'batente', 'oscilo-batente', 'correr']),
          skuCode,
        ),
      }),
      z.object({ role: z.enum(['blind', 'insect_screen']), sku_code: skuCode }),
    ]),
    [PricingRuleType.FIXED_ADDER]: z.union([
      z.object({ role: z.literal('minimum_billable_area'), area_m2: z.number().positive() }),
      z.object({
        role: z.literal('remove_existing'),
        amount_minor_per_opening: z.number().int().nonnegative(),
        description: z.string().min(1),
      }),
    ]),
    [PricingRuleType.CONDITIONAL_SURCHARGE]: z.object({
      role: z.literal('transport_per_km'),
      sku_code: skuCode,
      included_km: z.number().nonnegative(),
    }),
    [PricingRuleType.LABOR_HOURS]: z.object({
      role: z.literal('installation_per_opening'),
      sku_code: skuCode,
    }),
    [PricingRuleType.QTY_BREAK]: z.object({
      role: z.literal('area_discount'),
      thresholds: z
        .array(
          z.object({
            over_area_m2: z.number().nonnegative(),
            percentage: z.number().min(0).max(100),
          }),
        )
        .min(1),
    }),
    [PricingRuleType.MARGIN_MARKUP]: percentage,
    [PricingRuleType.TAX]: percentage,
  },
};

export function validatePricingRuleConfig(
  vertical: 'avac' | 'caixilharia',
  type: PricingRuleType,
  config: Record<string, unknown>,
): void {
  const schema = schemas[vertical][type];
  if (!schema) throw new Error(`Rule type ${type} is not supported for ${vertical}`);
  schema.parse(config);
}
