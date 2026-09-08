export type JsonParseResult =
  | { ok: true; value: Record<string, unknown> | null }
  | { ok: false; error: string };

/** Parses a JSON-object text field (SKU attributes, pricing rule config). Empty input is treated
 * as "not set" (null), not an error — callers that require a value check for null themselves. */
export function parseJsonObjectOrNull(raw: string): JsonParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'JSON inválido. Verifica a sintaxe (aspas, vírgulas, chavetas).' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Tem de ser um objeto JSON, por exemplo { "chave": "valor" }.' };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
}
