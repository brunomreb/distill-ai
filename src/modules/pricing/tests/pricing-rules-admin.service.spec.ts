import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PricingRuleType } from '../enums/pricing-rule-type.enum';
import { PricingRulesAdminService } from '../pricing-rules-admin.service';

const ORG_ID = '20000000-0000-0000-0000-000000000001';
const RULE_ID = '30000000-0000-0000-0000-000000000001';
const rule = {
  id: RULE_ID,
  org_id: ORG_ID,
  vertical: 'avac',
  rule_key: 'avac.margin',
  rule_type: PricingRuleType.MARGIN_MARKUP,
  config: { percentage: 32 },
  sort_order: 100,
  active: true,
};

function setup() {
  const repository = {
    find: vi.fn().mockResolvedValue([rule]),
    create: vi.fn((value) => value),
    save: vi.fn().mockResolvedValue(rule),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    findOne: vi.fn().mockResolvedValue(rule),
  };
  return {
    service: new PricingRulesAdminService(repository as never),
    repository,
  };
}

describe('PricingRulesAdminService', () => {
  it('lists only rules owned by the selected tenant in deterministic order', async () => {
    const { service, repository } = setup();

    expect(await service.list(ORG_ID)).toEqual([rule]);
    expect(repository.find).toHaveBeenCalledWith({
      where: [
        { org_id: ORG_ID, vertical: 'avac' },
        { org_id: ORG_ID, vertical: 'caixilharia' },
      ],
      order: { sort_order: 'ASC', rule_key: 'ASC' },
    });
  });

  it('creates a rule under the selected tenant', async () => {
    const { service, repository } = setup();
    const input = {
      vertical: 'avac' as const,
      rule_key: 'avac.margin',
      rule_type: PricingRuleType.MARGIN_MARKUP,
      config: { percentage: 32 },
      sort_order: 100,
      active: true,
    };

    await service.create(ORG_ID, input);

    expect(repository.create).toHaveBeenCalledWith({ ...input, org_id: ORG_ID });
  });

  it('rejects invalid deterministic rule configuration before persistence', async () => {
    const { service, repository } = setup();

    await expect(
      service.create(ORG_ID, {
        vertical: 'avac',
        rule_key: 'avac.iva',
        rule_type: PricingRuleType.TAX,
        config: { percentage: 230 },
        sort_order: 110,
        active: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('updates by both rule and org ids and rejects cross-tenant ids', async () => {
    const { service, repository } = setup();

    await service.update(ORG_ID, RULE_ID, { config: { percentage: 30 } });
    expect(repository.update).toHaveBeenCalledWith(
      { id: RULE_ID, org_id: ORG_ID },
      { config: { percentage: 30 } },
    );

    repository.update.mockResolvedValue({ affected: 0 });
    await expect(service.update(ORG_ID, 'other-id', { active: false })).resolves.toBeNull();
  });

  it('soft-deactivates a rule so past quotes remain reproducible', async () => {
    const { service, repository } = setup();

    await service.deactivate(ORG_ID, RULE_ID);

    expect(repository.update).toHaveBeenCalledWith(
      { id: RULE_ID, org_id: ORG_ID },
      { active: false },
    );
  });
});
