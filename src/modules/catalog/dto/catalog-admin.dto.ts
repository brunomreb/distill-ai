import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAdminSkuDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description: string | null;

  @IsOptional()
  @IsObject()
  attributes: Record<string, unknown> | null;

  @IsInt()
  @Min(0)
  base_price_minor: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cost_minor: number | null;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  lead_time_days: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAdminSkuDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku_code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown> | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  base_price_minor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cost_minor?: number | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  lead_time_days?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
