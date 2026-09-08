import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PricingRuleType } from '../enums/pricing-rule-type.enum';

export class CreatePricingRuleDto {
  @IsIn(['avac', 'caixilharia'])
  vertical: 'avac' | 'caixilharia';

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  rule_key: string;

  @IsEnum(PricingRuleType)
  rule_type: PricingRuleType;

  @IsObject()
  config: Record<string, unknown>;

  @IsInt()
  sort_order: number;

  @IsBoolean()
  active: boolean;
}

export class UpdatePricingRuleDto {
  @IsOptional()
  @IsIn(['avac', 'caixilharia'])
  vertical?: 'avac' | 'caixilharia';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  rule_key?: string;

  @IsOptional()
  @IsEnum(PricingRuleType)
  rule_type?: PricingRuleType;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
