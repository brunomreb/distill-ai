import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { PricingRuleType } from '../enums/pricing-rule-type.enum';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('pricing_rules')
export class PricingRule extends BaseEntity {
  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'enum', enum: PricingRuleType, enumName: 'pricing_rule_type' })
  rule_type: PricingRuleType;

  @Column({ type: 'text', nullable: true })
  vertical: 'avac' | 'caixilharia' | null;

  @Column({ type: 'text', nullable: true })
  rule_key: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'jsonb' })
  config: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
