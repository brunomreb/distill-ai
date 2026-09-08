import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PricingController } from '../pricing.controller';
import { PricingRuleType } from '../enums/pricing-rule-type.enum';
import type { PricingRulesAdminService } from '../pricing-rules-admin.service';

const ORG_ID = '20000000-0000-0000-0000-000000000001';
const RULE_ID = '30000000-0000-0000-0000-000000000001';
const user = { orgId: ORG_ID, userId: 'admin', roles: ['admin'], email: 'admin@example.pt' };
const entityManager = {} as never;
const request = { user, entityManager };
const rule = {
  id: RULE_ID,
  vertical: 'avac',
  rule_key: 'avac.margin',
  rule_type: PricingRuleType.MARGIN_MARKUP,
  config: { percentage: 32 },
  sort_order: 100,
  active: true,
};

function setup() {
  const legacy = {} as never;
  const admin = {
    list: vi.fn().mockResolvedValue([rule]),
    create: vi.fn().mockResolvedValue(rule),
    update: vi.fn().mockResolvedValue(rule),
    deactivate: vi.fn().mockResolvedValue({ ...rule, active: false }),
  } as unknown as PricingRulesAdminService;
  return { controller: new PricingController(legacy, admin), admin };
}

describe('PricingController admin rules', () => {
  it('lists tenant-scoped rules', async () => {
    const { controller, admin } = setup();
    const result = await controller.listAdminRules(request);
    expect(result.data).toEqual([rule]);
    expect(admin.list).toHaveBeenCalledWith(ORG_ID, entityManager);
  });

  it('creates tenant-scoped rules', async () => {
    const { controller, admin } = setup();
    const input = {
      vertical: 'avac' as const,
      rule_key: 'avac.margin',
      rule_type: PricingRuleType.MARGIN_MARKUP,
      config: { percentage: 32 },
      sort_order: 100,
      active: true,
    };
    const result = await controller.createAdminRule(input, request);
    expect(result.statusCode).toBe(HttpStatus.CREATED);
    expect(admin.create).toHaveBeenCalledWith(ORG_ID, input, entityManager);
  });

  it('returns a non-enumerating 404 for inaccessible rules', async () => {
    const { controller, admin } = setup();
    vi.mocked(admin.update).mockResolvedValue(null);
    await expect(
      controller.updateAdminRule(RULE_ID, { active: false }, request),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
  });

  it('soft-deactivates a rule', async () => {
    const { controller, admin } = setup();
    const result = await controller.deactivateAdminRule(RULE_ID, request);
    expect(result.data.active).toBe(false);
    expect(admin.deactivate).toHaveBeenCalledWith(ORG_ID, RULE_ID, entityManager);
  });
});
