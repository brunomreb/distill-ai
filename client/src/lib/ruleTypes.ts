import type { RuleType } from '../api/pricingRules';

/** PT-PT label per rule_type, from the build spec (section 5) plus qty_break (section 7). The
 * single source of truth for RulesPanel and RuleFormModal, so every rule_type the engine can
 * persist stays editable without code — no second copy to fall out of sync. */
export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  catalog_unit: 'Preço unitário do catálogo',
  included_allowance: 'Quantidade incluída',
  conditional_surcharge: 'Sobretaxa condicional',
  fixed_adder: 'Extra fixo',
  labor_hours: 'Horas de mão de obra',
  margin_markup: 'Margem comercial',
  tax: 'Imposto (IVA)',
  qty_break: 'Desconto por escalões de quantidade',
};

export const RULE_TYPES = Object.keys(RULE_TYPE_LABELS) as RuleType[];
