import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { PricingRule } from './entities/pricing-rule.entity';
import { PricingRuleType } from './enums/pricing-rule-type.enum';
import { validatePricingRuleConfig } from './pricing-rule-config.validator';

export interface AdminPricingRuleInput {
  vertical: 'avac' | 'caixilharia';
  rule_key: string;
  rule_type: PricingRuleType;
  config: Record<string, unknown>;
  sort_order: number;
  active: boolean;
}

export type AdminPricingRulePatch = Partial<AdminPricingRuleInput>;

@Injectable()
export class PricingRulesAdminService {
  constructor(
    @InjectRepository(PricingRule)
    private readonly rules: Repository<PricingRule>,
  ) {}

  async list(orgId: string, entityManager?: EntityManager): Promise<PricingRule[]> {
    return this.repository(entityManager).find({
      where: [
        { org_id: orgId, vertical: 'avac' },
        { org_id: orgId, vertical: 'caixilharia' },
      ],
      order: { sort_order: 'ASC', rule_key: 'ASC' },
    });
  }

  async create(
    orgId: string,
    input: AdminPricingRuleInput,
    entityManager?: EntityManager,
  ): Promise<PricingRule> {
    this.assertValid(input.vertical, input.rule_type, input.config);
    const rules = this.repository(entityManager);
    return rules.save(rules.create({ ...input, rule_key: input.rule_key.trim(), org_id: orgId }));
  }

  async update(
    orgId: string,
    id: string,
    patch: AdminPricingRulePatch,
    entityManager?: EntityManager,
  ): Promise<PricingRule | null> {
    const rules = this.repository(entityManager);
    const current = await rules.findOne({ where: { id, org_id: orgId } });
    if (!current) return null;
    const vertical = patch.vertical ?? current.vertical;
    const type = patch.rule_type ?? current.rule_type;
    const config = patch.config ?? current.config;
    if (!vertical) throw new BadRequestException('A regra tem de indicar um vertical.');
    this.assertValid(vertical, type, config);

    const normalized = { ...patch };
    if (patch.rule_key !== undefined) normalized.rule_key = patch.rule_key.trim();
    const result = await rules.update(
      { id, org_id: orgId },
      normalized as QueryDeepPartialEntity<PricingRule>,
    );
    if ((result.affected ?? 0) === 0) return null;
    return rules.findOne({ where: { id, org_id: orgId } });
  }

  async deactivate(
    orgId: string,
    id: string,
    entityManager?: EntityManager,
  ): Promise<PricingRule | null> {
    return this.update(orgId, id, { active: false }, entityManager);
  }

  private repository(entityManager?: EntityManager): Repository<PricingRule> {
    return entityManager?.getRepository(PricingRule) ?? this.rules;
  }

  private assertValid(
    vertical: 'avac' | 'caixilharia',
    type: PricingRuleType,
    config: Record<string, unknown>,
  ): void {
    try {
      validatePricingRuleConfig(vertical, type, config);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'configuração inválida';
      throw new BadRequestException(`Configuração de regra inválida: ${detail}`);
    }
  }
}
