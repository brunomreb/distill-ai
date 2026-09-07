import { vi } from 'vitest';

const { authState } = vi.hoisted(() => ({ authState: { enabled: true } }));
vi.mock('@config/auth.config', () => ({ authConfig: authState }));

import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { DEMO_ORG_ID } from '@modules/ingestion/ingestion.constants';
import { QuoteListController } from '../quote-list.controller';
import type { QuoteModelAction } from '../quote.model-action';
import { QuoteStatus } from '../enums/quote-status.enum';

const quote = {
  id: 'quote-1',
  request_id: 'request-1',
  quote_number: 'Q-001',
  status: QuoteStatus.READY,
  total_minor: 831527,
  currency: 'EUR',
  pdf_storage_url: 'quotes/org-1/quote-1.pdf',
  created_at: new Date('2026-09-07T12:00:00.000Z'),
  request: {
    sender_company: null,
    sender_contact: 'João Martins',
    sender_email: 'joao@example.pt',
  },
};

function setup() {
  const listForOrg = vi.fn().mockResolvedValue([quote]);
  const controller = new QuoteListController({ listForOrg } as unknown as QuoteModelAction);
  return { controller, listForOrg };
}

describe('QuoteListController.list', () => {
  beforeEach(() => {
    authState.enabled = true;
  });

  it('returns the caller organization register without leaking storage paths', async () => {
    const { controller, listForOrg } = setup();

    const result = await controller.list({ user: { orgId: 'org-1' } as never });

    expect(listForOrg).toHaveBeenCalledWith('org-1');
    expect(result.data).toEqual([
      {
        id: 'quote-1',
        request_id: 'request-1',
        quote_number: 'Q-001',
        status: 'ready',
        total_minor: 831527,
        currency: 'EUR',
        customer_name: 'João Martins',
        customer_email: 'joao@example.pt',
        pdf_ready: true,
        created_at: new Date('2026-09-07T12:00:00.000Z'),
      },
    ]);
    expect(result.data[0]).not.toHaveProperty('pdf_storage_url');
  });

  it('fails closed without a user when auth is enabled', async () => {
    const { controller, listForOrg } = setup();

    await expect(controller.list({})).rejects.toBeInstanceOf(CustomHttpException);
    expect(listForOrg).not.toHaveBeenCalled();
  });

  it('uses the demo organization only when auth is disabled', async () => {
    authState.enabled = false;
    const { controller, listForOrg } = setup();

    await controller.list({});

    expect(listForOrg).toHaveBeenCalledWith(DEMO_ORG_ID);
  });
});
