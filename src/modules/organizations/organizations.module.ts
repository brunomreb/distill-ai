import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationsController } from './organizations.controller';
import { OrgBranding } from './entities/org-branding.entity';
import { ObjectStoreModule } from '@common/object-store/object-store.module';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrgBranding]), ObjectStoreModule],
  controllers: [OrganizationsController],
  exports: [TypeOrmModule],
})
export class OrganizationsModule {}
