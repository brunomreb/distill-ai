import { z } from 'zod';
import type { Sku } from '@modules/catalog/entities/sku.entity';
import type { AvacExtractionV1 } from '@modules/extraction/schemas/extraction-v1.schema';
import type { PricingRule } from './entities/pricing-rule.entity';
import { PricingRuleType } from './enums/pricing-rule-type.enum';

export type AvacQuoteLineKind =
  | 'equipment'
  | 'material'
  | 'labor'
  | 'consumable'
  | 'margin'
  | 'tax';

export interface AvacQuoteLine {
  skuId: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  position: number;
  kind: AvacQuoteLineKind;
}

export interface AvacPricedQuote {
  lines: AvacQuoteLine[];
  subtotalMinor: number;
  discountMinor: 0;
  taxMinor: number;
  totalMinor: number;
  leadTimeDays: number | null;
  currency: string;
  blocked: boolean;
  missingRules: string[];
}

const IndoorSelectionSchema = z.object({
  role: z.literal('indoor_unit'),
  selections: z.array(
    z.object({ max_area_m2: z.number().positive().nullable(), sku_code: z.string().min(1) }),
  ),
  default_sku_code: z.string().min(1),
});
const OutdoorSelectionSchema = z.object({
  role: z.literal('outdoor_unit'),
  sku_code: z.string().min(1),
  max_indoor_units: z.number().int().positive(),
});
const AllowanceSchema = z.object({
  variable: z.enum(['pipe_length_m', 'outdoor_unit_distance_m']),
  included: z.number().nonnegative(),
  unit_price_minor: z.number().int().nonnegative(),
  description: z.string().min(1),
  kind: z.enum(['material', 'labor', 'consumable']),
});
const ConditionalSchema = z.object({
  variable: z.enum(['install_height_m', 'wall_type', 'distance_km', 'install_type']),
  operator: z.enum(['eq', 'gt']),
  value: z.union([z.string(), z.number(), z.boolean()]),
  amount_minor: z.number().int().nonnegative(),
  description: z.string().min(1),
  kind: z.enum(['material', 'labor', 'consumable']),
});
const FixedAdderSchema = z.object({
  variable: z.literal('needs_electrical_panel'),
  when: z.boolean(),
  amount_minor: z.number().int().nonnegative(),
  description: z.string().min(1),
  kind: z.enum(['material', 'labor', 'consumable']),
});
const LaborSchema = z.object({
  rate_minor: z.number().int().nonnegative(),
  hours_by_unit_count: z.record(z.string(), z.number().positive()),
  description: z.string().min(1),
});
const PercentageSchema = z.object({ percentage: z.number().min(0).max(100) });

/**
 * Pure AVAC pricing boundary. It accepts only persisted catalog/rule rows and interpreted request
 * facts; there is deliberately no LLM/tool dependency anywhere in this module.
 */
export function priceAvacQuote(
  extraction: AvacExtractionV1,
  allRules: PricingRule[],
  catalog: Sku[],
  options: { taxRate?: number } = {},
): AvacPricedQuote {
  const rules = allRules
    .filter((rule) => rule.active && rule.vertical === 'avac')
    .sort((a, b) => a.sort_order - b.sort_order);
  const skuByCode = new Map(catalog.map((sku) => [sku.sku_code, sku]));
  const lines: AvacQuoteLine[] = [];
  const missingRules: string[] = [];
  let position = 1;

  const indoorRule = parsedRule(
    rules,
    PricingRuleType.CATALOG_UNIT,
    IndoorSelectionSchema,
    'indoor_unit',
  );
  const outdoorRule = parsedRule(
    rules,
    PricingRuleType.CATALOG_UNIT,
    OutdoorSelectionSchema,
    'outdoor_unit',
  );
  const explicitCount = extraction.avac.indoor_units_requested;
  const unitCount = explicitCount ?? extraction.avac.areas.length;

  if (unitCount < 1) missingRules.push('critical_input.indoor_units_or_areas');
  if (!indoorRule) missingRules.push('avac.indoor.selection');
  if (!outdoorRule) missingRules.push('avac.outdoor.selection');
  if (outdoorRule && unitCount > outdoorRule.max_indoor_units) {
    missingRules.push('avac.outdoor.capacity');
  }

  if (indoorRule) {
    const selectedCodes: string[] = [];
    for (let index = 0; index < unitCount; index++) {
      const area = extraction.avac.areas[index]?.area_m2 ?? null;
      const selection =
        area === null
          ? undefined
          : indoorRule.selections.find(
              (candidate) => candidate.max_area_m2 === null || area <= candidate.max_area_m2,
            );
      selectedCodes.push(selection?.sku_code ?? indoorRule.default_sku_code);
    }
    for (const [skuCode, quantity] of countValues(selectedCodes)) {
      const sku = skuByCode.get(skuCode);
      if (!sku) {
        missingRules.push(`catalog.${skuCode}`);
        continue;
      }
      lines.push({
        skuId: sku.id,
        description: sku.name,
        quantity,
        unitPriceMinor: sku.base_price_minor,
        amountMinor: sku.base_price_minor * quantity,
        position: position++,
        kind: 'equipment',
      });
    }
  }

  if (outdoorRule && unitCount > 0 && unitCount <= outdoorRule.max_indoor_units) {
    const sku = skuByCode.get(outdoorRule.sku_code);
    if (!sku) {
      missingRules.push(`catalog.${outdoorRule.sku_code}`);
    } else {
      lines.push({
        skuId: sku.id,
        description: sku.name,
        quantity: 1,
        unitPriceMinor: sku.base_price_minor,
        amountMinor: sku.base_price_minor,
        position: position++,
        kind: 'equipment',
      });
    }
  }

  for (const rule of rules.filter(
    (candidate) => candidate.rule_type === PricingRuleType.INCLUDED_ALLOWANCE,
  )) {
    const config = AllowanceSchema.safeParse(rule.config);
    if (!config.success) continue;
    const actual = extraction.avac[config.data.variable];
    if (actual === null) continue;
    const excess = Math.max(0, actual - config.data.included);
    if (excess === 0) continue;
    lines.push({
      skuId: null,
      description: config.data.description,
      quantity: excess,
      unitPriceMinor: config.data.unit_price_minor,
      amountMinor: Math.round(excess * config.data.unit_price_minor),
      position: position++,
      kind: config.data.kind,
    });
  }

  for (const rule of rules.filter(
    (candidate) => candidate.rule_type === PricingRuleType.CONDITIONAL_SURCHARGE,
  )) {
    const config = ConditionalSchema.safeParse(rule.config);
    if (!config.success) continue;
    const actual = extraction.avac[config.data.variable];
    if (actual === null || !conditionMatches(actual, config.data.operator, config.data.value))
      continue;
    lines.push(
      fixedLine(config.data.description, config.data.amount_minor, position++, config.data.kind),
    );
  }

  for (const rule of rules.filter(
    (candidate) => candidate.rule_type === PricingRuleType.FIXED_ADDER,
  )) {
    const config = FixedAdderSchema.safeParse(rule.config);
    if (!config.success || extraction.avac.needs_electrical_panel !== config.data.when) continue;
    lines.push(
      fixedLine(config.data.description, config.data.amount_minor, position++, config.data.kind),
    );
  }

  const laborRule = parsedRule(rules, PricingRuleType.LABOR_HOURS, LaborSchema);
  const hours = laborRule?.hours_by_unit_count[String(unitCount)];
  if (!laborRule || hours === undefined) {
    missingRules.push('avac.installation.labor');
  } else {
    lines.push({
      skuId: null,
      description: laborRule.description,
      quantity: hours,
      unitPriceMinor: laborRule.rate_minor,
      amountMinor: hours * laborRule.rate_minor,
      position: position++,
      kind: 'labor',
    });
  }

  const baseMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const marginRule = parsedRule(rules, PricingRuleType.MARGIN_MARKUP, PercentageSchema);
  const taxRule = parsedRule(rules, PricingRuleType.TAX, PercentageSchema);
  if (!marginRule) missingRules.push('avac.margin');
  if (!taxRule) missingRules.push('avac.iva');

  if (marginRule) {
    const amount = Math.round((baseMinor * marginRule.percentage) / 100);
    lines.push(
      fixedLine(
        `Margem comercial (${formatPercentage(marginRule.percentage)}%)`,
        amount,
        position++,
        'margin',
      ),
    );
  }
  const subtotalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const taxPercentage = options.taxRate === undefined ? taxRule?.percentage : options.taxRate * 100;
  const taxMinor =
    taxPercentage === undefined ? 0 : Math.round((subtotalMinor * taxPercentage) / 100);
  if (taxRule) {
    lines.push(
      fixedLine(`IVA (${formatPercentage(taxPercentage ?? 0)}%)`, taxMinor, position++, 'tax'),
    );
  }

  const relevantSkus = lines
    .map((line) => (line.skuId ? catalog.find((sku) => sku.id === line.skuId) : undefined))
    .filter((sku): sku is Sku => sku !== undefined);
  const leadTimes = relevantSkus
    .map((sku) => sku.lead_time_days)
    .filter((days): days is number => days !== null);

  return {
    lines,
    subtotalMinor,
    discountMinor: 0,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor,
    leadTimeDays: leadTimes.length > 0 ? Math.max(...leadTimes) : null,
    currency: relevantSkus[0]?.currency ?? 'EUR',
    blocked: missingRules.length > 0,
    missingRules,
  };
}

function parsedRule<T extends z.ZodTypeAny>(
  rules: PricingRule[],
  type: PricingRuleType,
  schema: T,
  role?: string,
): z.infer<T> | null {
  for (const rule of rules) {
    if (rule.rule_type !== type) continue;
    if (role !== undefined && rule.config.role !== role) continue;
    const parsed = schema.safeParse(rule.config);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function conditionMatches(
  actual: unknown,
  operator: 'eq' | 'gt',
  expected: string | number | boolean,
): boolean {
  if (operator === 'eq') return actual === expected;
  return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
}

function fixedLine(
  description: string,
  amount: number,
  position: number,
  kind: AvacQuoteLineKind,
): AvacQuoteLine {
  return {
    skuId: null,
    description,
    quantity: 1,
    unitPriceMinor: amount,
    amountMinor: amount,
    position,
    kind,
  };
}

function formatPercentage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toLocaleString('pt-PT');
}
