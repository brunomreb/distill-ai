import { parseJsonObjectOrNull } from './jsonField';

describe('parseJsonObjectOrNull', () => {
  it('parses a valid JSON object', () => {
    const result = parseJsonObjectOrNull('{"threshold": 3, "unit": "m"}');
    expect(result).toEqual({ ok: true, value: { threshold: 3, unit: 'm' } });
  });

  it('treats empty input as null (no attributes/config set)', () => {
    expect(parseJsonObjectOrNull('')).toEqual({ ok: true, value: null });
    expect(parseJsonObjectOrNull('   ')).toEqual({ ok: true, value: null });
  });

  it('rejects malformed JSON with a readable PT-PT error', () => {
    const result = parseJsonObjectOrNull('{threshold: 3}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/inválido/i);
    }
  });

  it('rejects a JSON array — must be an object', () => {
    const result = parseJsonObjectOrNull('[1, 2, 3]');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/objeto/i);
    }
  });

  it('rejects a bare JSON primitive — must be an object', () => {
    const result = parseJsonObjectOrNull('"hello"');
    expect(result.ok).toBe(false);
  });
});
