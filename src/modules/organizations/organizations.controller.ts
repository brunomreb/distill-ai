import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Optional,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EntityManager, Repository } from 'typeorm';
import { authConfig } from '@config/auth.config';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { Role } from '@modules/auth/enums/role.enum';
import type { AuthUser } from '@modules/auth/interfaces/auth-user.interface';
import * as SYS_MSG from '@constants/system-messages';
import { Organization } from './entities/organization.entity';
import { OrgBranding } from './entities/org-branding.entity';
import { OnboardOrganizationDto, UpdateBrandingDto } from './dto/organizations.dto';
import {
  OBJECT_STORE,
  ObjectNotFoundError,
  type ObjectStore,
} from '@common/object-store/object-store.port';

interface OrganizationSummary {
  id: string;
  name: string;
  vertical: 'avac' | 'caixilharia';
}

interface OrganizationRequest {
  user?: AuthUser;
  entityManager?: EntityManager;
}

interface BrandingLogoUpload {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @Optional()
    @InjectRepository(OrgBranding)
    private readonly branding?: Repository<OrgBranding>,
    @Optional()
    @Inject(OBJECT_STORE)
    private readonly objectStore?: ObjectStore,
  ) {}

  /** Lists both seeded tenants in local demo mode; production callers only ever see their tenant. */
  @Get()
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  async list(
    @Req() req: OrganizationRequest,
  ): Promise<{ statusCode: number; message: string; data: OrganizationSummary[] }> {
    const where = authConfig.enabled
      ? { id: req.user?.orgId ?? '00000000-0000-0000-0000-000000000099' }
      : { demo_enabled: true };
    const organizations = await this.organizationRepository(req.entityManager).find({
      where,
      order: { name: 'ASC' },
    });
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.ORGANIZATIONS_RETRIEVED,
      data: organizations.map(({ id, name, vertical }) => ({ id, name, vertical })),
    };
  }

  @Post('onboarding')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async onboard(@Body() input: OnboardOrganizationDto, @Req() req: OrganizationRequest = {}) {
    if (authConfig.enabled) {
      throw new ForbiddenException('O onboarding requer um administrador de plataforma.');
    }
    const organizations = this.organizationRepository(req.entityManager);
    const organization = await organizations.save(
      organizations.create({
        name: input.name.trim(),
        vertical: input.vertical,
        demo_enabled: true,
      }),
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: SYS_MSG.ORGANIZATION_CREATED,
      data: { id: organization.id, name: organization.name, vertical: organization.vertical },
    };
  }

  @Get('current/branding')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  async getBranding(@Req() req: OrganizationRequest) {
    const data = await this.findOrCreateBranding(this.requireOrg(req.user), req.entityManager);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.BRANDING_RETRIEVED, data };
  }

  /** Streams the private tenant logo through the authenticated API for browser previews. */
  @Get('current/branding/logo')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  async getLogo(@Req() req: OrganizationRequest, @Res() res: Response): Promise<void> {
    const orgId = this.requireOrg(req.user);
    const current = await this.brandingRepository(req.entityManager).findOne({
      where: { org_id: orgId },
    });
    const key = current?.logo_url;
    const allowedKeys = [`branding/${orgId}/logo.png`, `branding/${orgId}/logo.jpg`];
    if (!key || !allowedKeys.includes(key)) {
      throw new NotFoundException('A organização ainda não tem logótipo.');
    }

    let bytes: Buffer;
    try {
      bytes = await this.requireObjectStore().get(key);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        throw new NotFoundException('O logótipo da organização não foi encontrado.');
      }
      throw error;
    }

    res.setHeader('Content-Type', key.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    res.setHeader('Content-Length', bytes.length);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(bytes);
  }

  @Patch('current/branding')
  @Roles(Role.ADMIN)
  async updateBranding(@Body() patch: UpdateBrandingDto, @Req() req: OrganizationRequest) {
    const orgId = this.requireOrg(req.user);
    const current = await this.findOrCreateBranding(orgId, req.entityManager);
    const normalized = {
      ...current,
      ...patch,
      primary_color:
        patch.primary_color === null ? '#5eead4' : (patch.primary_color ?? current.primary_color),
    };
    const data = await this.brandingRepository(req.entityManager).save(normalized);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.BRANDING_UPDATED, data };
  }

  @Post('current/branding/logo')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadLogo(
    @UploadedFile() file: BrandingLogoUpload | undefined,
    @Req() req: OrganizationRequest,
  ) {
    if (!file) throw new BadRequestException('Selecione um ficheiro PNG ou JPEG.');
    const extension = this.imageExtension(file);
    const orgId = this.requireOrg(req.user);
    const current = await this.findOrCreateBranding(orgId, req.entityManager);
    const key = `branding/${orgId}/logo.${extension}`;
    const storageUrl = await this.requireObjectStore().put(key, file.buffer);
    const data = await this.brandingRepository(req.entityManager).save({
      ...current,
      logo_url: storageUrl,
    });
    return { statusCode: HttpStatus.CREATED, message: SYS_MSG.BRANDING_UPDATED, data };
  }

  private async findOrCreateBranding(
    orgId: string,
    entityManager?: EntityManager,
  ): Promise<OrgBranding> {
    const branding = this.brandingRepository(entityManager);
    const found = await branding.findOne({ where: { org_id: orgId } });
    if (found) return found;

    const organization = await this.organizationRepository(entityManager).findOne({
      where: { id: orgId },
    });
    if (!organization) throw new UnauthorizedException(SYS_MSG.AUTH_UNAUTHORIZED);
    return branding.save(
      branding.create({
        org_id: orgId,
        company_name: organization.name,
        logo_url: null,
        primary_color: '#5eead4',
        vat_number: null,
        address: null,
        footer_text: null,
        iva_rate: 0.23,
        email: null,
        phone: null,
        quote_validity_days: 30,
      }),
    );
  }

  private brandingRepository(entityManager?: EntityManager): Repository<OrgBranding> {
    if (entityManager) return entityManager.getRepository(OrgBranding);
    if (!this.branding) throw new Error('OrgBranding repository is not configured');
    return this.branding;
  }

  private organizationRepository(entityManager?: EntityManager): Repository<Organization> {
    return entityManager?.getRepository(Organization) ?? this.organizations;
  }

  private requireObjectStore(): ObjectStore {
    if (!this.objectStore) throw new Error('Object store is not configured');
    return this.objectStore;
  }

  private imageExtension(file: BrandingLogoUpload): 'png' | 'jpg' {
    const bytes = file.buffer;
    const isPng =
      file.mimetype === 'image/png' &&
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (isPng) return 'png';
    const isJpeg =
      file.mimetype === 'image/jpeg' &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    if (isJpeg) return 'jpg';
    throw new BadRequestException('O logótipo tem de ser uma imagem PNG ou JPEG válida.');
  }

  private requireOrg(user: AuthUser | undefined): string {
    if (!user?.orgId) throw new UnauthorizedException(SYS_MSG.AUTH_UNAUTHORIZED);
    return user.orgId;
  }
}
