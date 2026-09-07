import { z } from 'zod';

export const UNKNOWN_FIELD = 'UNKNOWN';

function isValidIsoDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export const ExtractionLineItemSchema = z.object({
  position: z.number().finite().int().positive(),
  raw_text: z.string().min(1),
  quantity: z.number().finite().positive(),
  unit: z.string().min(1),
});

/** Accepts null or a non-empty string; maps the legacy UNKNOWN sentinel to null. An absent key still fails validation. */
const nullableExtractionField = z.preprocess(
  (value) => (value === UNKNOWN_FIELD ? null : value),
  z.string().min(1).nullable(),
);

/** Same as nullableExtractionField, but also maps an absent key to null (field predates this in older fixtures/tool outputs). */
const optionalNullableExtractionField = z.preprocess(
  (value) => (value === UNKNOWN_FIELD || value === undefined ? null : value),
  z.string().min(1).nullable(),
);

export const LegacyExtractionV1Schema = z.object({
  company: nullableExtractionField,
  contact: nullableExtractionField,
  sender_address: optionalNullableExtractionField,
  sender_email: z.string().email().nullable(),
  delivery_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isValidIsoDate, { message: 'Invalid calendar date' })
    .nullable(),
  line_items: z.array(ExtractionLineItemSchema).min(1),
});

const CustomerSchema = z.object({
  name: z.string().min(1).nullable(),
  email: z.string().email().nullable(),
  phone: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
});

const AvacAreaSchema = z.object({
  room: z.string().min(1),
  area_m2: z.number().finite().positive().nullable(),
});

export const AvacExtractionV1Schema = z.object({
  vertical: z.literal('avac'),
  customer: CustomerSchema,
  avac: z.object({
    system_type: z.enum(['mono-split', 'multi-split', 'vrv']).nullable(),
    brand_preference: z.string().min(1).nullable(),
    areas: z.array(AvacAreaSchema),
    indoor_units_requested: z.number().int().positive().nullable(),
    pipe_length_m: z.number().finite().positive().nullable(),
    install_height_m: z.number().finite().positive().nullable(),
    wall_type: z.enum(['alvenaria', 'betao', 'pladur']).nullable(),
    outdoor_unit_distance_m: z.number().finite().nonnegative().nullable(),
    needs_electrical_panel: z.boolean().nullable(),
    distance_km: z.number().finite().nonnegative().nullable(),
    install_type: z.enum(['standard', 'complex']).nullable(),
    notes: z.string(),
  }),
  missing_info: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
});

const CaixilhariaOpeningSchema = z.object({
  ref: z.string().min(1),
  location: z.string().min(1).nullable(),
  width_mm: z.number().int().positive().nullable(),
  height_mm: z.number().int().positive().nullable(),
  opening_type: z.enum(['fixo', 'batente', 'oscilo-batente', 'correr']).nullable(),
  profile_preference: z.string().min(1).nullable(),
  glass_preference: z.string().min(1).nullable(),
  finish: z.string().min(1).nullable(),
  hardware: z.string().min(1).nullable(),
  blind: z.boolean().nullable(),
  insect_screen: z.boolean().nullable(),
  quantity: z.number().int().positive(),
});

export const CaixilhariaExtractionV1Schema = z.object({
  vertical: z.literal('caixilharia'),
  customer: CustomerSchema,
  caixilharia: z.object({
    openings: z.array(CaixilhariaOpeningSchema).min(1),
    remove_existing: z.boolean().nullable(),
    floor: z.number().int().nonnegative().nullable(),
    distance_km: z.number().finite().nonnegative().nullable(),
    notes: z.string(),
  }),
  missing_info: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
});

/** Legacy input remains accepted to keep the fork mergeable; Stratos uses vertical branches. */
export const ExtractionV1Schema = z.union([
  AvacExtractionV1Schema,
  CaixilhariaExtractionV1Schema,
  LegacyExtractionV1Schema,
]);

export type ExtractionLineItem = z.infer<typeof ExtractionLineItemSchema>;
export type ExtractionV1 = z.infer<typeof ExtractionV1Schema>;
export type AvacExtractionV1 = z.infer<typeof AvacExtractionV1Schema>;
export type CaixilhariaExtractionV1 = z.infer<typeof CaixilhariaExtractionV1Schema>;

export function isAvacExtraction(value: ExtractionV1): value is AvacExtractionV1 {
  return 'vertical' in value && value.vertical === 'avac';
}

export function isCaixilhariaExtraction(value: ExtractionV1): value is CaixilhariaExtractionV1 {
  return 'vertical' in value && value.vertical === 'caixilharia';
}

/** JSON Schema supplied to Claude structured outputs; it contains no price or discount fields. */
export const AVAC_EXTRACTION_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['vertical', 'customer', 'avac', 'missing_info', 'confidence'],
  properties: {
    vertical: { const: 'avac' },
    customer: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'email', 'phone', 'address'],
      properties: {
        name: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        address: { type: ['string', 'null'] },
      },
    },
    avac: {
      type: 'object',
      additionalProperties: false,
      required: [
        'system_type',
        'brand_preference',
        'areas',
        'indoor_units_requested',
        'pipe_length_m',
        'install_height_m',
        'wall_type',
        'outdoor_unit_distance_m',
        'needs_electrical_panel',
        'distance_km',
        'install_type',
        'notes',
      ],
      properties: {
        system_type: { type: ['string', 'null'], enum: ['mono-split', 'multi-split', 'vrv', null] },
        brand_preference: { type: ['string', 'null'] },
        areas: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['room', 'area_m2'],
            properties: { room: { type: 'string' }, area_m2: { type: ['number', 'null'] } },
          },
        },
        indoor_units_requested: { type: ['integer', 'null'] },
        pipe_length_m: { type: ['number', 'null'] },
        install_height_m: { type: ['number', 'null'] },
        wall_type: { type: ['string', 'null'], enum: ['alvenaria', 'betao', 'pladur', null] },
        outdoor_unit_distance_m: { type: ['number', 'null'] },
        needs_electrical_panel: { type: ['boolean', 'null'] },
        distance_km: { type: ['number', 'null'] },
        install_type: { type: ['string', 'null'], enum: ['standard', 'complex', null] },
        notes: { type: 'string' },
      },
    },
    missing_info: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
};

export const CAIXILHARIA_EXTRACTION_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['vertical', 'customer', 'caixilharia', 'missing_info', 'confidence'],
  properties: {
    vertical: { const: 'caixilharia' },
    customer: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'email', 'phone', 'address'],
      properties: {
        name: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        address: { type: ['string', 'null'] },
      },
    },
    caixilharia: {
      type: 'object',
      additionalProperties: false,
      required: ['openings', 'remove_existing', 'floor', 'distance_km', 'notes'],
      properties: {
        openings: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'ref',
              'location',
              'width_mm',
              'height_mm',
              'opening_type',
              'profile_preference',
              'glass_preference',
              'finish',
              'hardware',
              'blind',
              'insect_screen',
              'quantity',
            ],
            properties: {
              ref: { type: 'string' },
              location: { type: ['string', 'null'] },
              width_mm: { type: ['integer', 'null'] },
              height_mm: { type: ['integer', 'null'] },
              opening_type: {
                type: ['string', 'null'],
                enum: ['fixo', 'batente', 'oscilo-batente', 'correr', null],
              },
              profile_preference: { type: ['string', 'null'] },
              glass_preference: { type: ['string', 'null'] },
              finish: { type: ['string', 'null'] },
              hardware: { type: ['string', 'null'] },
              blind: { type: ['boolean', 'null'] },
              insect_screen: { type: ['boolean', 'null'] },
              quantity: { type: 'integer', minimum: 1 },
            },
          },
        },
        remove_existing: { type: ['boolean', 'null'] },
        floor: { type: ['integer', 'null'] },
        distance_km: { type: ['number', 'null'] },
        notes: { type: 'string' },
      },
    },
    missing_info: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
};

/** Claude chooses the vertical; neither branch contains monetary output fields. */
export const STRATOS_EXTRACTION_JSON_SCHEMA: Record<string, unknown> = {
  oneOf: [AVAC_EXTRACTION_JSON_SCHEMA, CAIXILHARIA_EXTRACTION_JSON_SCHEMA],
};

export const ExtractRequestInputSchema = z.object({
  text: z.string(),
  priorFailure: z.string().nullable(),
});

export type ExtractRequestInput = z.infer<typeof ExtractRequestInputSchema>;

/** Formats Zod validation errors for corrective re-ask prompts. */
export function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}
