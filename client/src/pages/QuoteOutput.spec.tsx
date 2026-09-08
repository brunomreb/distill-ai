import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QuoteOutput } from './QuoteOutput';
import { PageHeaderProvider, usePageHeader } from '../context/PageHeaderContext';
import type { RequestDetail, QuoteDetail } from '../api/requests';

const {
  mockUseRequest,
  mockUseApproveQuote,
  mockApproveMutate,
  mockDownloadQuotePdf,
  mockUseClipboardCopy,
  mockCopy,
  mockUseSendQuote,
  mockSendMutate,
} = vi.hoisted(() => ({
  mockUseRequest: vi.fn(),
  mockUseApproveQuote: vi.fn(),
  mockApproveMutate: vi.fn(),
  mockDownloadQuotePdf: vi.fn(),
  mockUseClipboardCopy: vi.fn(),
  mockCopy: vi.fn(),
  mockUseSendQuote: vi.fn(),
  mockSendMutate: vi.fn(),
}));

vi.mock('../api/requests', () => ({
  useRequest: () => mockUseRequest(),
}));

vi.mock('../api/quotes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/quotes')>();
  return {
    ...actual,
    useApproveQuote: () => mockUseApproveQuote(),
    downloadQuotePdf: (requestId: string) => mockDownloadQuotePdf(requestId),
    useSendQuote: () => mockUseSendQuote(),
  };
});

vi.mock('../hooks/useClipboardCopy', () => ({
  useClipboardCopy: () => mockUseClipboardCopy(),
}));

const draftQuote: QuoteDetail = {
  quote_number: 'Q-2041',
  status: 'draft',
  subtotal_minor: 378000,
  discount_minor: 0,
  total_minor: 412000,
  currency: 'GBP',
  lead_time_days: 7,
  pdf_storage_url: null,
  pdf_generated_at: null,
  email_draft_subject: null,
  email_draft_body: null,
  email_sent_at: null,
  email_recipient: null,
  lines: [
    {
      position: 1,
      sku_id: 'sku-1',
      description: 'Hex Bolt M10x50 Stainless A4',
      quantity: 2000,
      unit_price_minor: 45,
      amount_minor: 90000,
    },
  ],
};

const requestFixture: RequestDetail = {
  id: 'req-1',
  sender_company: 'Apex Fabrication',
  sender_contact: 'James Okafor',
  sender_email: 'james.okafor@apexfab.example',
  sender_address: null,
  source_subject: 'RFQ',
  source_body: null,
  request_type: 'catalog_rfq',
  status: 'priced',
  overall_confidence: 0.98,
  current_node: 'price',
  created_at: '2026-06-24T10:00:00.000Z',
  attachments: [
    {
      id: 'att-1',
      filename: 'RFQ_Apex_Oct24.eml',
      mime_type: 'message/rfc822',
      size_bytes: 2048,
      created_at: '2026-06-24T10:00:00.000Z',
    },
  ],
  routing: 'auto_eligible',
  routing_reasons: [],
  line_items: [],
  quote: draftQuote,
  vertical: 'avac',
};

function PageHeaderSlots() {
  const { title, actions } = usePageHeader();
  return (
    <>
      <div data-testid="topbar-title">{title}</div>
      <div data-testid="topbar-actions">{actions}</div>
    </>
  );
}

function renderQuoteOutput() {
  return render(
    <PageHeaderProvider>
      <MemoryRouter initialEntries={['/requests/req-1/quote']}>
        <PageHeaderSlots />
        <Routes>
          <Route path="/requests/:id/quote" element={<QuoteOutput />} />
        </Routes>
      </MemoryRouter>
    </PageHeaderProvider>,
  );
}

describe('QuoteOutput', () => {
  beforeEach(() => {
    mockUseRequest.mockReset();
    mockUseApproveQuote.mockReset();
    mockApproveMutate.mockReset();
    mockDownloadQuotePdf.mockReset();
    mockUseClipboardCopy.mockReset();
    mockCopy.mockReset();
    mockUseSendQuote.mockReset();
    mockSendMutate.mockReset();

    mockUseApproveQuote.mockReturnValue({
      mutate: mockApproveMutate,
      isPending: false,
      isError: false,
      error: undefined,
    });
    mockUseClipboardCopy.mockReturnValue({ status: 'idle', copy: mockCopy });
    mockUseSendQuote.mockReturnValue({
      mutate: mockSendMutate,
      isPending: false,
      isError: false,
      error: undefined,
    });
  });

  it('pre-approval: shows the draft preview with PDF disabled and approval active', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByRole('button', { name: /descarregar pdf/i })).toBeDisabled();
    const approveButton = screen.getByRole('button', { name: /aprovar orçamento/i });
    expect(approveButton).toBeEnabled();
    expect(approveButton.textContent?.toLowerCase()).not.toMatch(/send/);
  });

  it('shows the vertical badge next to the quote title', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByText('AVAC')).toBeInTheDocument();
  });

  it('calls approveQuote.mutate when approval is clicked', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();
    await user.click(screen.getByRole('button', { name: /aprovar orçamento/i }));

    expect(mockApproveMutate).toHaveBeenCalled();
  });

  it('transitions in place to the post-approval render once the request cache reflects a ready quote', () => {
    const readyRequest: RequestDetail = {
      ...requestFixture,
      quote: {
        ...draftQuote,
        status: 'ready',
        pdf_storage_url: 'https://cdn.example/q-2041.pdf',
        pdf_generated_at: '2026-07-01T00:00:00.000Z',
      },
    };
    mockUseRequest.mockReturnValue({
      data: readyRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByRole('button', { name: /descarregar pdf/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /aprovar orçamento/i })).not.toBeInTheDocument();
    expect(screen.getByText(/este orçamento foi aprovado/i)).toBeInTheDocument();
  });

  it('shows the send-email button only when the quote is ready and a recipient is known', () => {
    const readyRequest: RequestDetail = {
      ...requestFixture,
      quote: { ...draftQuote, status: 'ready', pdf_storage_url: 'https://cdn.example/q.pdf' },
    };
    mockUseRequest.mockReturnValue({
      data: readyRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByRole('button', { name: /enviar por email/i })).toBeEnabled();
  });

  it('never auto-sends on mount, even when ready with a known recipient', () => {
    const readyRequest: RequestDetail = {
      ...requestFixture,
      quote: { ...draftQuote, status: 'ready', pdf_storage_url: 'https://cdn.example/q.pdf' },
    };
    mockUseRequest.mockReturnValue({
      data: readyRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(mockSendMutate).not.toHaveBeenCalled();
  });

  it('hides the send-email button when the quote is not yet ready', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.queryByRole('button', { name: /enviar por email/i })).not.toBeInTheDocument();
  });

  it('hides the send-email button when there is no known recipient', () => {
    const readyRequest: RequestDetail = {
      ...requestFixture,
      sender_email: null,
      quote: { ...draftQuote, status: 'ready', pdf_storage_url: 'https://cdn.example/q.pdf' },
    };
    mockUseRequest.mockReturnValue({
      data: readyRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.queryByRole('button', { name: /enviar por email/i })).not.toBeInTheDocument();
  });

  it('calls sendQuote.mutate when the send-email button is clicked', async () => {
    const readyRequest: RequestDetail = {
      ...requestFixture,
      quote: { ...draftQuote, status: 'ready', pdf_storage_url: 'https://cdn.example/q.pdf' },
    };
    mockUseRequest.mockReturnValue({
      data: readyRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();

    renderQuoteOutput();
    await user.click(screen.getByRole('button', { name: /enviar por email/i }));

    expect(mockSendMutate).toHaveBeenCalled();
  });

  it('shows a sent confirmation with the recipient and no send button once the quote is sent (idempotent)', () => {
    const sentRequest: RequestDetail = {
      ...requestFixture,
      quote: {
        ...draftQuote,
        status: 'sent',
        pdf_storage_url: 'https://cdn.example/q.pdf',
        email_sent_at: '2026-09-08T10:00:00.000Z',
        email_recipient: 'james.okafor@apexfab.example',
      },
    };
    mockUseRequest.mockReturnValue({
      data: sentRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.queryByRole('button', { name: /enviar por email/i })).not.toBeInTheDocument();
    expect(screen.getByText(/enviado.*james\.okafor@apexfab\.example/i)).toBeInTheDocument();
  });

  it('shows a readable error when sending fails', async () => {
    const readyRequest: RequestDetail = {
      ...requestFixture,
      quote: { ...draftQuote, status: 'ready', pdf_storage_url: 'https://cdn.example/q.pdf' },
    };
    mockUseRequest.mockReturnValue({
      data: readyRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseSendQuote.mockReturnValue({
      mutate: mockSendMutate,
      isPending: false,
      isError: true,
      error: { response: { status: 424, data: { message: 'Sem destinatário válido.' } } },
    });

    renderQuoteOutput();

    expect(screen.getByText('Sem destinatário válido.')).toBeInTheDocument();
  });

  it('fires the PDF fetch when the PDF button is clicked in the ready state', async () => {
    const user = userEvent.setup();
    const readyRequest: RequestDetail = {
      ...requestFixture,
      quote: { ...draftQuote, status: 'ready', pdf_storage_url: 'https://cdn.example/q.pdf' },
    };
    mockUseRequest.mockReturnValue({
      data: readyRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockDownloadQuotePdf.mockResolvedValue(new Blob(['PDF'], { type: 'application/pdf' }));
    URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderQuoteOutput();
    await user.click(screen.getByRole('button', { name: /descarregar pdf/i }));

    expect(mockDownloadQuotePdf).toHaveBeenCalledWith('req-1');
    clickSpy.mockRestore();
  });

  it('renders a 409 approve failure using the server message', () => {
    mockUseApproveQuote.mockReturnValue({
      mutate: mockApproveMutate,
      isPending: false,
      isError: true,
      error: { response: { status: 409, data: { message: 'Quote has not been priced yet.' } } },
    });
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByText('Quote has not been priced yet.')).toBeInTheDocument();
  });

  it('renders a 424 approve failure using generic copy when the server sends no message', () => {
    mockUseApproveQuote.mockReturnValue({
      mutate: mockApproveMutate,
      isPending: false,
      isError: true,
      error: { response: { status: 424, data: {} } },
    });
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(
      screen.getByText(/não foi possível gerar o pdf\. tenta novamente\./i),
    ).toBeInTheDocument();
  });

  it('falls back to a client-side template when the server email draft is null', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByLabelText('Assunto')).toHaveValue('Orçamento Q-2041 — Stratos');
  });

  it('renders the server-provided email draft when present', () => {
    mockUseRequest.mockReturnValue({
      data: {
        ...requestFixture,
        quote: {
          ...draftQuote,
          email_draft_subject: 'Your quote from Distill.ai',
          email_draft_body: 'Hi James, please find your quote attached.',
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByLabelText('Assunto')).toHaveValue('Your quote from Distill.ai');
    expect(screen.getByLabelText('Mensagem')).toHaveValue(
      'Hi James, please find your quote attached.',
    );
  });

  it('copies the combined subject and body when copy is clicked', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();
    await user.click(screen.getByRole('button', { name: /^copiar$/i }));

    expect(mockCopy).toHaveBeenCalledWith(
      'Orçamento Q-2041 — Stratos\n\nOlá,\n\nSegue em anexo o orçamento Q-2041, no valor total de 4120,00 GBP. O prazo estimado é de 7 dias úteis.\n\nCom os melhores cumprimentos,\nStratos',
      expect.anything(),
    );
  });
});
