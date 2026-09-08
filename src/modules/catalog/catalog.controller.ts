import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { authConfig } from '@config/auth.config';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CatalogService } from './catalog.service';
import { SearchSkusDocs } from './docs/catalog-swagger.doc';
import * as SYS_MSG from '@constants/system-messages';
import { DEFAULT_DEMO_ORG_ID } from '@modules/auth/demo-org';
import { CreateAdminSkuDto, UpdateAdminSkuDto } from './dto/catalog-admin.dto';
import { CatalogImportService, type CatalogUpload } from './catalog-import.service';
import type { EntityManager } from 'typeorm';
import type { WithAfterCommit } from '@common/http/after-commit';

interface CatalogRequest extends WithAfterCommit {
  user?: AuthUser;
  entityManager?: EntityManager;
}

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly catalogImport: CatalogImportService,
  ) {}

  @Get('admin/skus')
  @Roles(Role.ADMIN)
  async listAdmin(@Req() req: CatalogRequest) {
    const data = await this.catalogService.listAdmin(this.requireOrg(req.user), req.entityManager);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.SKUS_RETRIEVED, data };
  }

  @Post('admin/skus')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() input: CreateAdminSkuDto, @Req() req: CatalogRequest) {
    const data = await this.catalogService.createAdmin(
      this.requireOrg(req.user),
      input,
      req.entityManager,
    );
    return { statusCode: HttpStatus.CREATED, message: SYS_MSG.SKU_CREATED, data };
  }

  @Patch('admin/skus/:id')
  @Roles(Role.ADMIN)
  async updateAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() patch: UpdateAdminSkuDto,
    @Req() req: CatalogRequest,
  ) {
    const data = await this.catalogService.updateAdmin(
      this.requireOrg(req.user),
      id,
      patch,
      req.entityManager,
    );
    if (!data) throw new NotFoundException(SYS_MSG.SKU_NOT_FOUND);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.SKU_UPDATED, data };
  }

  @Delete('admin/skus/:id')
  @Roles(Role.ADMIN)
  async deactivateAdmin(@Param('id', ParseUUIDPipe) id: string, @Req() req: CatalogRequest) {
    const data = await this.catalogService.deactivateAdmin(
      this.requireOrg(req.user),
      id,
      req.entityManager,
    );
    if (!data) throw new NotFoundException(SYS_MSG.SKU_NOT_FOUND);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.SKU_DEACTIVATED, data };
  }

  @Post('admin/import')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importCatalog(@UploadedFile() file: CatalogUpload | undefined, @Req() req: CatalogRequest) {
    if (!file) throw new BadRequestException('Selecione um ficheiro CSV ou XLSX.');
    const data = await this.catalogImport.import(
      this.requireOrg(req.user),
      file,
      req.entityManager,
      req.afterCommit,
    );
    return { statusCode: HttpStatus.CREATED, message: SYS_MSG.CATALOG_IMPORTED, data };
  }

  /** Manual catalog search for the re-map drawer, scoped to the caller's org (US-E6-2 FR-1). */
  @Get('skus')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @SearchSkusDocs()
  async searchSkus(
    @Query('q') q: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Req() req: CatalogRequest,
  ) {
    let orgId: string | undefined = authConfig.enabled
      ? req.user?.orgId
      : (req.user?.orgId ?? DEFAULT_DEMO_ORG_ID);
    if (authConfig.enabled) {
      const user = req.user;
      if (!user) {
        throw new CustomHttpException(SYS_MSG.AUTH_UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
      }
      if (!user.orgId) {
        throw new CustomHttpException(SYS_MSG.AUTH_FORBIDDEN, HttpStatus.FORBIDDEN);
      }
      orgId = user.orgId;
    }

    const limit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
    const data = await this.catalogService.searchSkus(
      q ?? '',
      orgId,
      Number.isFinite(limit) ? (limit as number) : undefined,
      req.entityManager,
    );

    return { statusCode: HttpStatus.OK, message: SYS_MSG.SKUS_RETRIEVED, data };
  }

  private requireOrg(user: AuthUser | undefined): string {
    if (!user) {
      throw new CustomHttpException(SYS_MSG.AUTH_UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }
    if (!user.orgId) {
      throw new CustomHttpException(SYS_MSG.AUTH_FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    return user.orgId;
  }
}
