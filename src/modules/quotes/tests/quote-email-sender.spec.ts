import { beforeEach, describe, expect, it, vi } from 'vitest';

const { envState } = vi.hoisted(() => ({
  envState: {
    DEMO_MODE: false,
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'Stratos <orcamentos@example.pt>',
  },
}));
vi.mock('@config/env', () => ({ env: envState }));

import { ResendQuoteEmailSender } from '../services/quote-email-sender';

const input = {
  to: 'cliente@example.pt',
  subject: 'Orçamento ORC-001',
  text: 'Segue o orçamento.',
  attachment: Buffer.from('pdf'),
  filename: 'ORC-001.pdf',
  idempotencyKey: 'quote/send/quote-1',
};

describe('ResendQuoteEmailSender', () => {
  beforeEach(() => {
    envState.DEMO_MODE = false;
    envState.RESEND_API_KEY = 're_test';
    vi.unstubAllGlobals();
  });

  it('uses Resend attachment and idempotency contracts without exposing the key in the client', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'email-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(new ResendQuoteEmailSender().send(input)).resolves.toEqual({
      messageId: 'email-1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test',
          'Idempotency-Key': input.idempotencyKey,
        }),
        body: expect.stringContaining(Buffer.from('pdf').toString('base64')),
      }),
    );
  });

  it('simulates delivery safely in demo mode without a network request', async () => {
    envState.DEMO_MODE = true;
    envState.RESEND_API_KEY = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(new ResendQuoteEmailSender().send(input)).resolves.toEqual({
      messageId: `demo:${input.idempotencyKey}`,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
