import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Organization } from './organization.entity';
import { numericTransformer } from '@common/transformers/numeric.transformer';

@Entity('org_branding')
export class OrgBranding extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  org_id: string;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'text' })
  company_name: string;

  @Column({ type: 'text', nullable: true })
  logo_url: string | null;

  @Column({ type: 'text', default: '#5eead4' })
  primary_color: string;

  @Column({ type: 'text', nullable: true })
  vat_number: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  footer_text: string | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 4,
    default: 0.23,
    transformer: numericTransformer,
  })
  iva_rate: number;

  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'int', default: 30 })
  quote_validity_days: number;
}
