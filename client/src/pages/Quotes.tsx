import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuotes, type QuoteSummary } from '../api/quotes';
import { ErrorBanner } from '../components/inbox/ErrorBanner';
import { usePageHeader } from '../context/PageHeaderContext';
import { formatMoney } from '../lib/formatMoney';

const STATUS_LABELS: Record<QuoteSummary['status'], string> = {
  draft: 'Rascunho',
  approved: 'Aprovado',
  ready: 'PDF pronto',
  sent: 'Enviado',
};

const STATUS_STYLES: Record<QuoteSummary['status'], string> = {
  draft: 'bg-amber-100 text-amber-800',
  approved: 'bg-sky-100 text-sky-700',
  ready: 'bg-emerald-100 text-emerald-700',
  sent: 'bg-sent-bg text-sent-tx',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function matchesSearch(quote: QuoteSummary, query: string): boolean {
  if (!query) return true;
  return [quote.quote_number, quote.customer_name, quote.customer_email]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-PT')
    .includes(query.toLocaleLowerCase('pt-PT'));
}

export function Quotes() {
  const { setTitle } = usePageHeader();
  const { data, isLoading, isError, refetch } = useQuotes();
  const [search, setSearch] = useState('');

  useEffect(() => {
    setTitle(<h1 className="truncate text-lg font-extrabold text-slate-900">Orçamentos</h1>);
    return () => setTitle(null);
  }, [setTitle]);

  const quotes = useMemo(() => {
    const query = search.trim();
    return (data ?? []).filter((quote) => matchesSearch(quote, query));
  }, [data, search]);

  const readyCount = (data ?? []).filter((quote) => quote.pdf_ready).length;
  const totalValue = useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const quote of data ?? []) {
      byCurrency.set(quote.currency, (byCurrency.get(quote.currency) ?? 0) + quote.total_minor);
    }
    if (byCurrency.size === 0) return formatMoney(0, 'EUR');
    return [...byCurrency.entries()]
      .map(([currency, total]) => formatMoney(total, currency))
      .join(' · ');
  }, [data]);

  return (
    <div className="px-6 py-6">
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Orçamentos" value={String(data?.length ?? 0)} />
        <SummaryCard label="PDF prontos" value={String(readyCount)} />
        <SummaryCard label="Valor total por moeda" value={totalValue} />
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar por orçamento ou cliente"
          aria-label="Pesquisar orçamentos"
          className="h-9 w-full max-w-sm rounded-button border border-border bg-surface px-3 text-sm text-body-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {isError && !data ? (
        <ErrorBanner
          message="Não foi possível carregar os orçamentos."
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                {['Orçamento', 'Cliente', 'Valor', 'Estado', 'Criado', 'Documento'].map(
                  (column) => (
                    <th
                      key={column}
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted"
                    >
                      {column}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading && !data ? (
                <StateRow>A carregar orçamentos…</StateRow>
              ) : quotes.length === 0 ? (
                <StateRow>
                  {search.trim()
                    ? 'Nenhum orçamento corresponde à pesquisa.'
                    : 'Ainda não existem orçamentos.'}
                </StateRow>
              ) : (
                quotes.map((quote) => <QuoteRow key={quote.id} quote={quote} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StateRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}

function QuoteRow({ quote }: { quote: QuoteSummary }) {
  const customer = quote.customer_name ?? 'Cliente não identificado';
  return (
    <tr className="border-b border-border last:border-0 hover:bg-canvas">
      <td className="px-4 py-3">
        <Link
          to={`/requests/${quote.request_id}/quote`}
          className="font-semibold text-body-text hover:text-accent"
        >
          {quote.quote_number}
        </Link>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-body-text">{customer}</p>
        <p className="text-xs text-muted">{quote.customer_email ?? 'Sem email'}</p>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
        {formatMoney(quote.total_minor, quote.currency)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[quote.status]}`}
        >
          {STATUS_LABELS[quote.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted">{formatDate(quote.created_at)}</td>
      <td className="px-4 py-3">
        <Link
          to={`/requests/${quote.request_id}/quote`}
          className="inline-flex rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-body-text hover:border-accent hover:text-accent"
        >
          {quote.pdf_ready ? 'Ver PDF' : 'Rever'}
        </Link>
      </td>
    </tr>
  );
}
