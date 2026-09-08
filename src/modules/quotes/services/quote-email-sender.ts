import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { env } from '@config/env';

export interface SendQuoteEmailInput {
  to: string;
  subject: string;
  text: string;
  attachment: Buffer;
  filename: string;
  idempotencyKey: string;
}

export interface QuoteEmailSender {
  send(input: SendQuoteEmailInput): Promise<{ messageId: string }>;
}

export const QUOTE_EMAIL_SENDER = Symbol('QUOTE_EMAIL_SENDER');

@Injectable()
export class ResendQuoteEmailSender implements QuoteEmailSender {
  async send(input: SendQuoteEmailInput): Promise<{ messageId: string }> {
    if (env.DEMO_MODE) {
      return { messageId: `demo:${input.idempotencyKey}` };
    }
    if (!env.RESEND_API_KEY) {
      throw new ServiceUnavailableException('O envio de email ainda não está configurado.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        attachments: [{ filename: input.filename, content: input.attachment.toString('base64') }],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !payload.id) {
      throw new ServiceUnavailableException(
        payload.message ?? 'O fornecedor de email recusou o envio.',
      );
    }
    return { messageId: payload.id };
  }
}
