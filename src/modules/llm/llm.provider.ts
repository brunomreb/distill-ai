import { Injectable, Logger } from '@nestjs/common';
import { env } from '@config/env';
import * as SYS_MSG from '@constants/system-messages';

export interface LLMInvokeParams {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonSchema?: Record<string, unknown>;
}

export interface LLMInvokeResponse {
  text: string;
}

@Injectable()
export class LLMProvider {
  private readonly logger = new Logger(LLMProvider.name);

  async invoke(params: LLMInvokeParams): Promise<LLMInvokeResponse> {
    const { prompt, temperature = 0.2, maxTokens = 100, jsonSchema } = params;

    if (!env.LLM_API_KEY) {
      throw new Error('LLM_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.LLM_TIMEOUT_MS);

    try {
      if (env.LLM_PROVIDER === 'anthropic') {
        return await this.invokeAnthropic(
          { prompt, temperature, maxTokens, jsonSchema },
          controller,
        );
      }

      const baseUrl = env.LLM_BASE_URL ?? 'https://api.openai.com/v1';
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.LLM_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
          // suppresses extended thinking mode on providers that default it on (causes timeouts)
          enable_thinking: false,
          ...(jsonSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: { name: 'structured_output', strict: true, schema: jsonSchema },
                },
              }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(SYS_MSG.LLM_INVOCATION_FAILED(response.status, body));
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      return { text };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        this.logger.error(`LLM request timed out after ${env.LLM_TIMEOUT_MS}ms`);
        throw new Error(`LLM request timed out after ${env.LLM_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Anthropic Messages API adapter. Structured output is GA through output_config.format. */
  private async invokeAnthropic(
    params: Required<Pick<LLMInvokeParams, 'prompt' | 'temperature' | 'maxTokens'>> &
      Pick<LLMInvokeParams, 'jsonSchema'>,
    controller: AbortController,
  ): Promise<LLMInvokeResponse> {
    const baseUrl = env.LLM_BASE_URL ?? 'https://api.anthropic.com';
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.LLM_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        messages: [{ role: 'user', content: params.prompt }],
        ...(params.jsonSchema
          ? { output_config: { format: { type: 'json_schema', schema: params.jsonSchema } } }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(SYS_MSG.LLM_INVOCATION_FAILED(response.status, body));
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = data.content?.find((block) => block.type === 'text')?.text ?? '';
    return { text };
  }
}
