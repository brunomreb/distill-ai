import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { PricingService } from './pricing.service';
import { EvaluatePriceDto, ReloadRulesDto } from './dto/pricing.dto';
import type { PricingRulesConfig, PriceEvaluationResult } from './pricing.service';
import {
  EvaluatePriceDocs,
  GetPricingRulesDocs,
  ReloadPricingRulesDocs,
} from './docs/pricing-swagger.doc';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { Role } from '@modules/auth/enums/role.enum';
import type { AuthUser } from '@modules/auth/interfaces/auth-user.interface';
import { CreatePricingRuleDto, UpdatePricingRuleDto } from './dto/pricing-rule-admin.dto';
import { PricingRulesAdminService } from './pricing-rules-admin.service';
import type { EntityManager } from 'typeorm';

interface PricingRequest {
  user?: AuthUser;
  entityManager?: EntityManager;
}

@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricingService: PricingService,
    private readonly adminRules: PricingRulesAdminService,
  ) {}

  @Get('admin/rules')
  @Roles(Role.ADMIN)
  async listAdminRules(@Req() req: PricingRequest) {
    const data = await this.adminRules.list(this.requireOrg(req.user), req.entityManager);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.PRICING_RULES_RETRIEVED, data };
  }

  @Post('admin/rules')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createAdminRule(@Body() input: CreatePricingRuleDto, @Req() req: PricingRequest) {
    const data = await this.adminRules.create(this.requireOrg(req.user), input, req.entityManager);
    return { statusCode: HttpStatus.CREATED, message: SYS_MSG.PRICING_RULE_CREATED, data };
  }

  @Patch('admin/rules/:id')
  @Roles(Role.ADMIN)
  async updateAdminRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() patch: UpdatePricingRuleDto,
    @Req() req: PricingRequest,
  ) {
    const data = await this.adminRules.update(
      this.requireOrg(req.user),
      id,
      patch,
      req.entityManager,
    );
    if (!data) throw new NotFoundException(SYS_MSG.PRICING_RULE_NOT_FOUND);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.PRICING_RULE_UPDATED, data };
  }

  @Delete('admin/rules/:id')
  @Roles(Role.ADMIN)
  async deactivateAdminRule(@Param('id', ParseUUIDPipe) id: string, @Req() req: PricingRequest) {
    const data = await this.adminRules.deactivate(this.requireOrg(req.user), id, req.entityManager);
    if (!data) throw new NotFoundException(SYS_MSG.PRICING_RULE_NOT_FOUND);
    return { statusCode: HttpStatus.OK, message: SYS_MSG.PRICING_RULE_DEACTIVATED, data };
  }

  @Get('rules')
  @GetPricingRulesDocs()
  async getRules(): Promise<{
    statusCode: number;
    message: string;
    data: PricingRulesConfig;
  }> {
    const rules = await this.pricingService.getRules();
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.PRICING_RULES_RETRIEVED,
      data: rules,
    };
  }

  @Post('reload')
  @HttpCode(HttpStatus.OK)
  @ReloadPricingRulesDocs()
  async reload(@Body() dto: ReloadRulesDto): Promise<{
    statusCode: number;
    message: string;
    data: PricingRulesConfig;
  }> {
    try {
      const rules = await this.pricingService.reload(dto.configPath);
      return {
        statusCode: HttpStatus.OK,
        message: SYS_MSG.PRICING_RULES_RELOADED,
        data: rules,
      };
    } catch {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: SYS_MSG.PRICING_CONFIG_VALIDATION_FAILED,
          data: await this.pricingService.getRules(),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @EvaluatePriceDocs()
  async evaluate(@Body() dto: EvaluatePriceDto): Promise<{
    statusCode: number;
    message: string;
    data: PriceEvaluationResult;
  }> {
    const result = await this.pricingService.evaluate(dto);
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.PRICING_EVALUATED,
      data: result,
    };
  }

  private requireOrg(user: AuthUser | undefined): string {
    if (!user?.orgId) throw new UnauthorizedException(SYS_MSG.AUTH_UNAUTHORIZED);
    return user.orgId;
  }
}
