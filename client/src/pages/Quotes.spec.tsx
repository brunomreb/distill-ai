import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PageHeaderProvider } from '../context/PageHeaderContext';
import type { QuoteSummary } from '../api/quotes';
import { Quotes } from './Quotes';

const { mockUseQuotes } = vi.hoisted(() => ({ mockUseQuotes: vi.fn() }));

vi.mock('../api/quotes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/quotes')>();
  return { ...actual, useQuotes: () => mockUseQuotes() };
});

const quote: QuoteSummary = {
  id: 'quote-1',
  request_id: 'request-1',
  quote_number: 'Q-001',
  status: 'ready',
  total_minor: 831527,
  currency: 'EUR',
  customer_name: 'João Martins',
  customer_email: 'joao@example.pt',
  pdf_ready: true,
  created_at: '2026-09-07T12:00:00.000Z',
  vertical: 'avac',
};

function renderQuotes() {
  return render(
    <MemoryRouter>
      <PageHeaderProvider>
        <Quotes />
      </PageHeaderProvider>
    </MemoryRouter>,
  );
}

describe('Quotes', () => {
  it('shows real quotes with totals, status and a navigable PDF action', () => {
    mockUseQuotes.mockReturnValue({
      data: [quote],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuotes();

    expect(screen.getByText('Q-001')).toBeInTheDocument();
    expect(screen.getByText('João Martins')).toBeInTheDocument();
    expect(screen.getAllByText('8315,27 EUR')).toHaveLength(2);
    expect(screen.getByText('PDF pronto')).toBeInTheDocument();
    expect(screen.getByText('AVAC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver PDF' })).toHaveAttribute(
      'href',
      '/requests/request-1/quote',
    );
  });

  it('reuses the shared in-progress token for the approved status pill', () => {
    mockUseQuotes.mockReturnValue({
      data: [{ ...quote, status: 'approved' }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuotes();

    const pill = screen.getByText('Aprovado');
    expect(pill.className).toContain('bg-parse-bg');
    expect(pill.className).toContain('text-parse-tx');
  });

  it('filters by customer without losing the aggregate cards', async () => {
    mockUseQuotes.mockReturnValue({
      data: [quote],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderQuotes();

    await user.type(screen.getByRole('searchbox', { name: 'Pesquisar orçamentos' }), 'outro');

    expect(screen.getByText('Nenhum orçamento corresponde à pesquisa.')).toBeInTheDocument();
    expect(screen.getByText('PDF prontos')).toBeInTheDocument();
  });

  it('sums totals across multiple quotes, all in EUR', () => {
    mockUseQuotes.mockReturnValue({
      data: [quote, { ...quote, id: 'quote-2', quote_number: 'Q-002', total_minor: 10000 }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuotes();

    expect(screen.getByText('8415,27 EUR')).toBeInTheDocument();
  });

  it('offers retry when the register cannot be loaded', async () => {
    const refetch = vi.fn();
    mockUseQuotes.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();
    renderQuotes();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
