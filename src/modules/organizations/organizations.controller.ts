import { Controller, Get, HttpStatus, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiTags } from '@nestjs/swagger';
import { In, Repository } from 'typeorm';
import { authConfig } from '@config/auth.config';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { Role } from '@modules/auth/enums/role.enum';
import type { AuthUser } from '@modules/auth/interfaces/auth-user.interface';
import { CAIXILHARIA_DEMO_ORG_ID, DEFAULT_DEMO_ORG_ID } from '@modules/auth/demo-org';
import * as SYS_MSG from '@constants/system-messages';
import { Organization } from './entities/organization.entity';

interface OrganizationSummary {
  id: string;
  name: string;
  vertical: 'avac' | 'caixilharia';
}

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  /** Lists both seeded tenants in local demo mode; production callers only ever see their tenant. */
  @Get()
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  async list(
    @Req() req: { user?: AuthUser },
  ): Promise<{ statusCode: number; message: string; data: OrganizationSummary[] }> {
    const where = authConfig.enabled
      ? { id: req.user?.orgId ?? '00000000-0000-0000-0000-000000000099' }
      : { id: In([DEFAULT_DEMO_ORG_ID, CAIXILHARIA_DEMO_ORG_ID]) };
    const organizations = await this.organizations.find({ where, order: { name: 'ASC' } });
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.ORGANIZATIONS_RETRIEVED,
      data: organizations.map(({ id, name, vertical }) => ({ id, name, vertical })),
    };
  }
}
