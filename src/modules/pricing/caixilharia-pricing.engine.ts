import { z } from 'zod';
import type { Sku } from '@modules/catalog/entities/sku.entity';
import type { CaixilhariaExtractionV1 } from '@modules/extraction/schemas/extraction-v1.schema';
import type { PricingRule } from './entities/pricing-rule.entity';
import { PricingRuleType } from './enums/pricing-rule-type.enum';

export type CaixilhariaQuoteLineKind =
  | 'equipment'
  | 'material'
  | 'labor'
  | 'consumable'
  | 'margin'
  | 'tax';

export interface CaixilhariaQuoteLine {
  skuId: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  position: number;
  kind: CaixilhariaQuoteLineKind;
}

export interface CaixilhariaPricedQuote {
  lines: CaixilhariaQuoteLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  leadTimeDays: number | null;
  currency: string;
  totalAreaM2: number;
  blocked: boolean;
  missingRules: string[];
}

const OpeningTypeSchema = z.enum(['fixo', 'batente', 'oscilo-batente', 'correr']);
const OpeningTypeMultipliersSchema = z.record(OpeningTypeSchema, z.number().positive());

const ProfileRuleSchema = z.object({
  role: z.literal('profile'),
  selections: z.array(
    z.object({
      keywords: z.array(z.string().min(1)).min(1),
      sku_code: z.string().min(1),
    }),
  ),
  default_sku_code: z.string().min(1),
  opening_type_multipliers: OpeningTypeMultipliersSchema,
});

const GlassRuleSchema = z.object({
  role: z.literal('glass'),
  selections: z.array(
    z.object({
      keywords: z.array(z.string().min(1)).min(1),
      sku_code: z.string().min(1),
    }),
  ),
  default_sku_code: z.string().min(1),
});

const HardwareRuleSchema = z.object({
  role: z.literal('hardware'),
  sku_by_opening_type: z.record(OpeningTypeSchema, z.string().min(1)),
});

const FeatureRuleSchema = z.object({
  role: z.enum(['blind', 'insect_screen']),
  sku_code: z.string().min(1),
});

const MinimumAreaRuleSchema = z.object({
  role: z.literal('minimum_billable_area'),
  area_m2: z.number().positive(),
});

const RemovalRuleSchema = z.object({
  role: z.literal('remove_existing'),
  amount_minor_per_opening: z.number().int().nonnegative(),
  description: z.string().min(1),
});

const TransportRuleSchema = z.object({
  role: z.literal('transport_per_km'),
  sku_code: z.string().min(1),
  included_km: z.number().nonnegative().default(0),
});

const LaborRuleSchema = z.object({
  role: z.literal('installation_per_opening'),
  sku_code: z.string().min(1),
});

const AreaDiscountRuleSchema = z.object({
  role: z.literal('area_discount'),
  thresholds: z
    .array(
      z.object({
        over_area_m2: z.number().nonnegative(),
        percentage: z.number().min(0).max(100),
      }),
    )
    .min(1),
});

const PercentageRuleSchema = z.object({ percentage: z.number().min(0).max(100) });

/**
 * Pure caixilharia pricing boundary. The LLM supplies only explicitly stated request facts;
 * dimensions, billable areas, quantities, discounts, margin, tax and totals are calculated here
 * from tenant-owned catalog and pricing-rule rows. There is deliberately no tool/LLM dependency.
 */
export function priceCaixilhariaQuote(
  extraction: CaixilhariaExtractionV1,
  allRules: PricingRule[],
  catalog: Sku[],
  options: { taxRate?: number } = {},
): CaixilhariaPricedQuote {
  const rules = allRules
    .filter((rule) => rule.active && rule.vertical === 'caixilharia')
    .sort((a, b) => a.sort_order - b.sort_order);
  const skuByCode = new Map(
    catalog.filter((sku) => sku.active !== false).map((sku) => [sku.sku_code, sku]),
  );
  const lines: CaixilhariaQuoteLine[] = [];
  const missingRules: string[] = [];
  let position = 1;

  const profileRule = parsedRoleRule(
    rules,
    PricingRuleType.CATALOG_UNIT,
    'profile',
    ProfileRuleSchema,
  );
  const glassRule = parsedRoleRule(rules, PricingRuleType.CATALOG_UNIT, 'glass', GlassRuleSchema);
  const hardwareRule = parsedRoleRule(
    rules,
    PricingRuleType.CATALOG_UNIT,
    'hardware',
    HardwareRuleSchema,
  );
  const blindRule = parsedRoleRule(rules, PricingRuleType.CATALOG_UNIT, 'blind', FeatureRuleSchema);
  const screenRule = parsedRoleRule(
    rules,
    PricingRuleType.CATALOG_UNIT,
    'insect_screen',
    FeatureRuleSchema,
  );
  const minimumAreaRule = parsedRoleRule(
    rules,
    PricingRuleType.FIXED_ADDER,
    'minimum_billable_area',
    MinimumAreaRuleSchema,
  );
  const laborRule = parsedRoleRule(
    rules,
    PricingRuleType.LABOR_HOURS,
    'installation_per_opening',
    LaborRuleSchema,
  );

  if (!profileRule) missingRules.push('caixilharia.profile');
  if (!glassRule) missingRules.push('caixilharia.glass');
  if (!hardwareRule) missingRules.push('caixilharia.hardware');
  if (!blindRule) missingRules.push('caixilharia.blind');
  if (!screenRule) missingRules.push('caixilharia.insect_screen');
  if (!minimumAreaRule) missingRules.push('caixilharia.minimum_billable_area');
  if (!laborRule) missingRules.push('caixilharia.installation.labor');

  let totalAreaM2 = 0;
  let totalOpeningCount = 0;

  for (const opening of extraction.caixilharia.openings) {
    if (opening.width_mm === null) {
      missingRules.push(`critical_input.openings.${opening.ref}.width_mm`);
    }
    if (opening.height_mm === null) {
      missingRules.push(`critical_input.openings.${opening.ref}.height_mm`);
    }
    if (opening.opening_type === null) {
      missingRules.push(`critical_input.openings.${opening.ref}.opening_type`);
    }
    if (opening.width_mm === null || opening.height_mm === null) continue;

    const actualAreaM2 = roundArea((opening.width_mm * opening.height_mm) / 1_000_000);
    const billableAreaPerOpening = Math.max(actualAreaM2, minimumAreaRule?.area_m2 ?? actualAreaM2);
    const billableAreaM2 = roundArea(billableAreaPerOpening * opening.quantity);
    totalAreaM2 = roundArea(totalAreaM2 + actualAreaM2 * opening.quantity);
    totalOpeningCount += opening.quantity;

    if (profileRule) {
      const skuCode = selectSkuCode(
        opening.profile_preference,
        profileRule.selections,
        profileRule.default_sku_code,
      );
      const sku = requireSku(skuCode, skuByCode, missingRules);
      if (sku) {
        const multiplier =
          opening.opening_type === null
            ? 1
            : profileRule.opening_type_multipliers[opening.opening_type];
        if (multiplier === undefined) {
          missingRules.push(`caixilharia.profile.multiplier.${opening.opening_type}`);
        } else {
          lines.push(
            areaLine(
              sku,
              `${opening.ref} — ${sku.name}`,
              billableAreaM2,
              multiplier,
              position++,
              'material',
            ),
          );
        }
      }
    }

    if (glassRule) {
      const skuCode = selectSkuCode(
        opening.glass_preference,
        glassRule.selections,
        glassRule.default_sku_code,
      );
      const sku = requireSku(skuCode, skuByCode, missingRules);
      if (sku) {
        lines.push(
          areaLine(sku, `${opening.ref} — ${sku.name}`, billableAreaM2, 1, position++, 'material'),
        );
      }
    }

    // A fixed pane has no opening hardware; every operable type must map to a catalog SKU.
    if (hardwareRule && opening.opening_type !== null && opening.opening_type !== 'fixo') {
      const skuCode = hardwareRule.sku_by_opening_type[opening.opening_type];
      if (!skuCode) {
        missingRules.push(`caixilharia.hardware.${opening.opening_type}`);
      } else {
        const sku = requireSku(skuCode, skuByCode, missingRules);
        if (sku) {
          lines.push(
            catalogLine(
              sku,
              `${opening.ref} — ${sku.name}`,
              opening.quantity,
              position++,
              'equipment',
            ),
          );
        }
      }
    }

    if (opening.blind === true && blindRule) {
      const sku = requireSku(blindRule.sku_code, skuByCode, missingRules);
      if (sku) {
        lines.push(
          areaLine(sku, `${opening.ref} — ${sku.name}`, billableAreaM2, 1, position++, 'material'),
        );
      }
    }

    if (opening.insect_screen === true && screenRule) {
      const sku = requireSku(screenRule.sku_code, skuByCode, missingRules);
      if (sku) {
        lines.push(
          catalogLine(
            sku,
            `${opening.ref} — ${sku.name}`,
            opening.quantity,
            position++,
            'equipment',
          ),
        );
      }
    }
  }

  if (laborRule && totalOpeningCount > 0) {
    const sku = requireSku(laborRule.sku_code, skuByCode, missingRules);
    if (sku) {
      lines.push(catalogLine(sku, sku.name, totalOpeningCount, position++, 'labor'));
    }
  }

  const removalRule = parsedRoleRule(
    rules,
    PricingRuleType.FIXED_ADDER,
    'remove_existing',
    RemovalRuleSchema,
  );
  if (extraction.caixilharia.remove_existing === true) {
    if (!removalRule) {
      missingRules.push('caixilharia.remove_existing');
    } else {
      lines.push({
        skuId: null,
        description: removalRule.description,
        quantity: totalOpeningCount,
        unitPriceMinor: removalRule.amount_minor_per_opening,
        amountMinor: removalRule.amount_minor_per_opening * totalOpeningCount,
        position: position++,
        kind: 'labor',
      });
    }
  }

  const transportRule = parsedRoleRule(
    rules,
    PricingRuleType.CONDITIONAL_SURCHARGE,
    'transport_per_km',
    TransportRuleSchema,
  );
  if (extraction.caixilharia.distance_km !== null) {
    if (!transportRule) {
      missingRules.push('caixilharia.transport');
    } else {
      const chargeableKm = Math.max(
        0,
        extraction.caixilharia.distance_km - transportRule.included_km,
      );
      if (chargeableKm > 0) {
        const sku = requireSku(transportRule.sku_code, skuByCode, missingRules);
        if (sku) {
          lines.push(catalogLine(sku, sku.name, chargeableKm, position++, 'labor'));
        }
      }
    }
  }

  const baseMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const marginRule = parsedRule(rules, PricingRuleType.MARGIN_MARKUP, PercentageRuleSchema);
  const discountRule = parsedRoleRule(
    rules,
    PricingRuleType.QTY_BREAK,
    'area_discount',
    AreaDiscountRuleSchema,
  );
  const taxRule = parsedRule(rules, PricingRuleType.TAX, PercentageRuleSchema);
  if (!marginRule) missingRules.push('caixilharia.margin');
  if (!discountRule) missingRules.push('caixilharia.area_discount');
  if (!taxRule) missingRules.push('caixilharia.iva');

  if (marginRule) {
    const marginMinor = Math.round((baseMinor * marginRule.percentage) / 100);
    lines.push(
      fixedLine(
        `Margem comercial (${formatPercentage(marginRule.percentage)}%)`,
        marginMinor,
        position++,
        'margin',
      ),
    );
  }

  const subtotalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const discountPercentage = discountRule
    ? ([...discountRule.thresholds]
        .sort((a, b) => b.over_area_m2 - a.over_area_m2)
        .find((threshold) => totalAreaM2 > threshold.over_area_m2)?.percentage ?? 0)
    : 0;
  const discountMinor = Math.round((subtotalMinor * discountPercentage) / 100);
  const taxableMinor = subtotalMinor - discountMinor;
  const taxPercentage = options.taxRate === undefined ? taxRule?.percentage : options.taxRate * 100;
  const taxMinor =
    taxPercentage === undefined ? 0 : Math.round((taxableMinor * taxPercentage) / 100);
  if (taxRule) {
    lines.push(
      fixedLine(`IVA (${formatPercentage(taxPercentage ?? 0)}%)`, taxMinor, position++, 'tax'),
    );
  }

  const relevantSkus = lines
    .map((line) => (line.skuId ? catalog.find((sku) => sku.id === line.skuId) : undefined))
    .filter((sku): sku is Sku => sku !== undefined);
  const currencies = new Set(relevantSkus.map((sku) => sku.currency));
  if (currencies.size > 1) missingRules.push('catalog.currency_mismatch');
  const leadTimes = relevantSkus
    .map((sku) => sku.lead_time_days)
    .filter((days): days is number => days !== null);

  return {
    lines,
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor: taxableMinor + taxMinor,
    leadTimeDays: leadTimes.length > 0 ? Math.max(...leadTimes) : null,
    currency: relevantSkus[0]?.currency ?? 'EUR',
    totalAreaM2,
    blocked: unique(missingRules).length > 0,
    missingRules: unique(missingRules),
  };
}

function parsedRoleRule<T extends z.ZodTypeAny>(
  rules: PricingRule[],
  type: PricingRuleType,
  role: string,
  schema: T,
): z.infer<T> | null {
  return parsedRule(
    rules.filter((rule) => rule.config.role === role),
    type,
    schema,
  );
}

function parsedRule<T extends z.ZodTypeAny>(
  rules: PricingRule[],
  type: PricingRuleType,
  schema: T,
): z.infer<T> | null {
  for (const rule of rules) {
    if (rule.rule_type !== type) continue;
    const parsed = schema.safeParse(rule.config);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function selectSkuCode(
  preference: string | null,
  selections: Array<{ keywords: string[]; sku_code: string }>,
  fallback: string,
): string {
  if (preference === null) return fallback;
  const normalizedPreference = normalize(preference);
  return (
    selections.find((selection) =>
      selection.keywords.some((keyword) => normalizedPreference.includes(normalize(keyword))),
    )?.sku_code ?? fallback
  );
}

function requireSku(
  skuCode: string,
  skuByCode: Map<string, Sku>,
  missingRules: string[],
): Sku | null {
  const sku = skuByCode.get(skuCode);
  if (!sku) missingRules.push(`catalog.${skuCode}`);
  return sku ?? null;
}

function areaLine(
  sku: Sku,
  description: string,
  areaM2: number,
  multiplier: number,
  position: number,
  kind: CaixilhariaQuoteLineKind,
): CaixilhariaQuoteLine {
  const unitPriceMinor = Math.round(sku.base_price_minor * multiplier);
  return {
    skuId: sku.id,
    description,
    quantity: areaM2,
    unitPriceMinor,
    amountMinor: Math.round(areaM2 * unitPriceMinor),
    position,
    kind,
  };
}

function catalogLine(
  sku: Sku,
  description: string,
  quantity: number,
  position: number,
  kind: CaixilhariaQuoteLineKind,
): CaixilhariaQuoteLine {
  return {
    skuId: sku.id,
    description,
    quantity,
    unitPriceMinor: sku.base_price_minor,
    amountMinor: sku.base_price_minor * quantity,
    position,
    kind,
  };
}

function fixedLine(
  description: string,
  amountMinor: number,
  position: number,
  kind: CaixilhariaQuoteLineKind,
): CaixilhariaQuoteLine {
  return {
    skuId: null,
    description,
    quantity: 1,
    unitPriceMinor: amountMinor,
    amountMinor,
    position,
    kind,
  };
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT');
}

function roundArea(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function formatPercentage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toLocaleString('pt-PT');
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
