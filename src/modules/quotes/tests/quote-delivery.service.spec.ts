import { ConflictException, BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { QuoteStatus } from '../enums/quote-status.enum';
import { QuoteDeliveryService } from '../services/quote-delivery.service';

const request = {
  id: 'request-1',
  org_id: 'org-1',
  sender_email: 'cliente@example.pt',
  sender_contact: 'Ana',
  sender_company: 'Empresa Cliente',
};
const quote = {
  id: 'quote-1',
  org_id: 'org-1',
  request_id: request.id,
  quote_number: 'ORC-001',
  status: QuoteStatus.READY,
  subtotal_minor: 10000,
  discount_minor: 0,
  total_minor: 12300,
  currency: 'EUR',
  lead_time_days: 7,
  pdf_storage_url: 'quotes/org-1/quote-1.pdf',
  pdf_generated_at: new Date(),
  email_draft_subject: 'O seu orçamento ORC-001',
  email_draft_body: 'Olá Ana, segue o orçamento.',
  email_sent_at: null,
  email_recipient: null,
  email_provider_message_id: null,
  email_delivery_started_at: null,
};

function setup(overrides: Record<string, unknown> = {}) {
  const currentQuote = { ...quote, ...overrides };
  const quotes = {
    getForRequest: vi.fn().mockResolvedValue({ quote: currentQuote, lines: [] }),
    tryStartDelivery: vi.fn().mockResolvedValue(true),
    markSent: vi.fn().mockResolvedValue(true),
    getByIdWithLines: vi.fn().mockResolvedValue(null),
  };
  const requests = { trySetStatus: vi.fn().mockResolvedValue(true) };
  const objectStore = { get: vi.fn().mockResolvedValue(Buffer.from('pdf')) };
  const sender = { send: vi.fn().mockResolvedValue({ messageId: 'resend-1' }) };
  return {
    service: new QuoteDeliveryService(
      quotes as never,
      requests as never,
      objectStore as never,
      sender as never,
    ),
    quotes,
    requests,
    objectStore,
    sender,
  };
}

describe('QuoteDeliveryService', () => {
  it('sends a READY PDF once with a stable idempotency key and records delivery', async () => {
    const { service, sender, quotes, requests } = setup();

    const result = await service.send(request as never);

    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: request.sender_email,
        attachment: Buffer.from('pdf'),
        filename: 'ORC-001.pdf',
        idempotencyKey: 'quote/send/quote-1',
      }),
    );
    expect(quotes.tryStartDelivery).toHaveBeenCalledWith(
      quote.id,
      request.org_id,
      expect.any(Date),
    );
    expect(quotes.markSent).toHaveBeenCalledWith(
      quote.id,
      request.org_id,
      request.sender_email,
      'resend-1',
      expect.any(Date),
    );
    expect(requests.trySetStatus).toHaveBeenCalledWith(request.id, RequestStatus.SENT, [
      RequestStatus.READY,
      RequestStatus.PRICED,
      RequestStatus.NEEDS_REVIEW,
    ]);
    expect(result.quote).toMatchObject({
      status: QuoteStatus.SENT,
      email_recipient: request.sender_email,
    });
  });

  it('is idempotent after SENT and never invokes the provider again', async () => {
    const sentAt = new Date();
    const { service, sender, requests } = setup({
      status: QuoteStatus.SENT,
      email_sent_at: sentAt,
      email_recipient: request.sender_email,
    });

    const result = await service.send(request as never);

    expect(sender.send).not.toHaveBeenCalled();
    expect(requests.trySetStatus).toHaveBeenCalledWith(request.id, RequestStatus.SENT, [
      RequestStatus.READY,
      RequestStatus.PRICED,
      RequestStatus.NEEDS_REVIEW,
    ]);
    expect(result.quote.email_sent_at).toBe(sentAt);
  });

  it('rejects a draft quote and a request without recipient', async () => {
    const draft = setup({ status: QuoteStatus.DRAFT });
    await expect(draft.service.send(request as never)).rejects.toBeInstanceOf(ConflictException);

    const missingRecipient = setup();
    await expect(
      missingRecipient.service.send({ ...request, sender_email: null } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not risk a duplicate after the provider idempotency window has expired', async () => {
    const startedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { service, quotes, sender } = setup({ email_delivery_started_at: startedAt });
    quotes.tryStartDelivery.mockResolvedValue(false);
    quotes.getByIdWithLines.mockResolvedValue({
      quote: { ...quote, email_delivery_started_at: startedAt },
      lines: [],
    });

    await expect(service.send(request as never)).rejects.toBeInstanceOf(ConflictException);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('repairs the request when a concurrent sender already transitioned the quote to SENT', async () => {
    const { service, quotes, requests } = setup();
    quotes.markSent.mockResolvedValue(false);
    quotes.getByIdWithLines.mockResolvedValue({
      quote: { ...quote, status: QuoteStatus.SENT, email_sent_at: new Date() },
      lines: [],
    });

    await service.send(request as never);

    expect(requests.trySetStatus).toHaveBeenCalledWith(request.id, RequestStatus.SENT, [
      RequestStatus.READY,
      RequestStatus.PRICED,
      RequestStatus.NEEDS_REVIEW,
    ]);
  });
});
