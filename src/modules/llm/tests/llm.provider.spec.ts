import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMProvider } from '../llm.provider';

const testEnv = vi.hoisted(() => ({
  LLM_PROVIDER: 'anthropic' as 'anthropic' | 'openai-compatible',
  LLM_API_KEY: 'test-key',
  LLM_BASE_URL: undefined as string | undefined,
  LLM_MODEL: 'claude-sonnet-5',
  LLM_TIMEOUT_MS: 1000,
}));

vi.mock('@config/env', () => ({ env: testEnv }));

describe('LLMProvider', () => {
  beforeEach(() => {
    testEnv.LLM_PROVIDER = 'anthropic';
    testEnv.LLM_BASE_URL = undefined;
    vi.restoreAllMocks();
  });

  it('sends Claude structured output through output_config.format', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: 'text', text: '{"vertical":"avac"}' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const schema = { type: 'object', properties: { vertical: { const: 'avac' } } };

    const result = await new LLMProvider().invoke({
      prompt: 'pedido',
      maxTokens: 500,
      jsonSchema: schema,
    });

    expect(result.text).toBe('{"vertical":"avac"}');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.output_config).toEqual({ format: { type: 'json_schema', schema } });
    expect(body).not.toHaveProperty('tools');
  });

  it('keeps the upstream OpenAI-compatible adapter available for non-Stratos callers', async () => {
    testEnv.LLM_PROVIDER = 'openai-compatible';
    testEnv.LLM_BASE_URL = 'https://compatible.example/v1/';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new LLMProvider().invoke({ prompt: 'hello' });

    expect(result).toEqual({ text: 'ok' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://compatible.example/v1/chat/completions');
  });
});
