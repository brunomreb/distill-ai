import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class OnboardOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsIn(['avac', 'caixilharia'])
  vertical: 'avac' | 'caixilharia';
}

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  company_name?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  primary_color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vat_number?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  footer_text?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  iva_rate?: number;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  quote_validity_days?: number;
}
