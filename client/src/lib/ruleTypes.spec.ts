import { RULE_TYPE_LABELS, RULE_TYPES } from './ruleTypes';
import type { RuleType } from '../api/pricingRules';

// Every rule_type the pricing engine can persist must be editable without code: this is the one
// source of truth both RulesPanel and RuleFormModal read from, so it can't drift out of sync.
const EXPECTED_RULE_TYPES: RuleType[] = [
  'catalog_unit',
  'included_allowance',
  'conditional_surcharge',
  'fixed_adder',
  'labor_hours',
  'margin_markup',
  'tax',
  'qty_break',
];

describe('RULE_TYPES / RULE_TYPE_LABELS', () => {
  it('covers every RuleType exactly once', () => {
    expect([...RULE_TYPES].sort()).toEqual([...EXPECTED_RULE_TYPES].sort());
    expect(Object.keys(RULE_TYPE_LABELS).sort()).toEqual([...EXPECTED_RULE_TYPES].sort());
  });

  it('has a non-empty PT-PT label for qty_break (caixilharia area-based discounts)', () => {
    expect(RULE_TYPE_LABELS.qty_break).toMatch(/\S/);
  });
});
