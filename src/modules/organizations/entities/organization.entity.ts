import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', default: 'avac' })
  vertical: 'avac' | 'caixilharia';

  /** Allows tenant switching only in local/demo mode; ignored when real authentication is enabled. */
  @Column({ type: 'boolean', default: false })
  demo_enabled: boolean;
}
