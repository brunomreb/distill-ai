import {
  isAvacExtraction,
  isCaixilhariaExtraction,
  type ExtractionV1,
} from './schemas/extraction-v1.schema';

const QUANTITY_TOLERANCE = 0.01;

export type ReconcileResult = { ok: true } | { ok: false; reason: string };

/**
 * Deterministic field and totals check before accepting an LLM extraction.
 * Fails only when source text clearly states a count or total that does not match.
 */
export function reconcile(data: ExtractionV1, sourceText: string): ReconcileResult {
  if (isAvacExtraction(data)) {
    return reconcileAvac(data, sourceText);
  }
  if (isCaixilhariaExtraction(data)) {
    return reconcileCaixilharia(data, sourceText);
  }
  for (const item of data.line_items) {
    if (!item.unit.trim()) {
      return {
        ok: false,
        reason: `Line item ${item.position} is missing a unit`,
      };
    }
  }

  const statedItemCount = parseStatedItemCount(sourceText);
  if (statedItemCount !== null && data.line_items.length !== statedItemCount) {
    return {
      ok: false,
      reason: `Source states ${statedItemCount} items but extraction has ${data.line_items.length}`,
    };
  }

  const statedTotalQty = parseStatedTotalQuantity(sourceText);
  if (statedTotalQty !== null) {
    const extractedTotal = data.line_items.reduce((sum, item) => sum + item.quantity, 0);
    if (!Number.isFinite(extractedTotal)) {
      return { ok: false, reason: 'Extracted line item quantities are not finite' };
    }
    if (Math.abs(extractedTotal - statedTotalQty) > QUANTITY_TOLERANCE) {
      return {
        ok: false,
        reason: `Source total quantity ${statedTotalQty} does not match extracted sum ${extractedTotal}`,
      };
    }
  }

  return { ok: true };
}

function reconcileCaixilharia(
  data: Extract<ExtractionV1, { vertical: 'caixilharia' }>,
  sourceText: string,
): ReconcileResult {
  const normalized = sourceText.toLocaleLowerCase('pt-PT');
  for (const opening of data.caixilharia.openings) {
    const numericFacts: Array<[string, number | null]> = [
      [`${opening.ref}.width_mm`, opening.width_mm],
      [`${opening.ref}.height_mm`, opening.height_mm],
      [`${opening.ref}.quantity`, opening.quantity],
    ];
    for (const [field, value] of numericFacts) {
      if (value !== null && !sourceContainsNumber(normalized, value)) {
        return { ok: false, reason: `Valor extraído sem suporte no pedido: ${field}=${value}` };
      }
    }
  }
  const generalFacts: Array<[string, number | null]> = [
    ['floor', data.caixilharia.floor],
    ['distance_km', data.caixilharia.distance_km],
  ];
  for (const [field, value] of generalFacts) {
    if (value !== null && !sourceContainsNumber(normalized, value)) {
      return { ok: false, reason: `Valor extraído sem suporte no pedido: ${field}=${value}` };
    }
  }
  return { ok: true };
}

function reconcileAvac(
  data: Extract<ExtractionV1, { vertical: 'avac' }>,
  sourceText: string,
): ReconcileResult {
  const normalized = sourceText.toLocaleLowerCase('pt-PT');
  for (const area of data.avac.areas) {
    if (!normalized.includes(area.room.toLocaleLowerCase('pt-PT'))) {
      return { ok: false, reason: `Divisão extraída sem suporte no pedido: ${area.room}` };
    }
    if (area.area_m2 !== null && !sourceContainsNumber(normalized, area.area_m2)) {
      return { ok: false, reason: `Área extraída sem suporte no pedido: ${area.area_m2} m²` };
    }
  }
  const numericFacts: Array<[string, number | null]> = [
    ['indoor_units_requested', data.avac.indoor_units_requested],
    ['pipe_length_m', data.avac.pipe_length_m],
    ['install_height_m', data.avac.install_height_m],
    ['outdoor_unit_distance_m', data.avac.outdoor_unit_distance_m],
    ['distance_km', data.avac.distance_km],
  ];
  for (const [field, value] of numericFacts) {
    if (value !== null && !sourceContainsNumber(normalized, value)) {
      return { ok: false, reason: `Valor extraído sem suporte no pedido: ${field}=${value}` };
    }
  }
  return { ok: true };
}

function sourceContainsNumber(source: string, value: number): boolean {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const decimalComma = escaped.replace('.', ',');
  return new RegExp(`(^|\\D)(?:${escaped}|${decimalComma})(?=\\D|$)`).test(source);
}

function parseStatedItemCount(sourceText: string): number | null {
  const patterns = [
    /\b(\d+)\s+line\s+items?\b/i,
    /\btotal\s+(?:of\s+)?(\d+)\s+items?\b/i,
    /\b(\d+)\s+items?\s+total\b/i,
  ];

  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    if (match?.[1]) {
      const count = Number.parseInt(match[1], 10);
      if (Number.isFinite(count) && count > 0) {
        return count;
      }
    }
  }

  return null;
}

function parseStatedTotalQuantity(sourceText: string): number | null {
  const patterns = [
    /\btotal\s+(?:qty|quantity)[:\s]+(\d+(?:\.\d+)?)\b/i,
    /\btotal\s+(?:units|pieces)[:\s]+(\d+(?:\.\d+)?)\b/i,
    /\bgrand\s+total[:\s]+(\d+(?:\.\d+)?)\s+(?:units|pcs|pieces)\b/i,
  ];

  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    if (match?.[1]) {
      const total = Number.parseFloat(match[1]);
      if (Number.isFinite(total) && total > 0) {
        return total;
      }
    }
  }

  return null;
}
