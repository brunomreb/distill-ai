import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { requestKeys } from './requests';
import type { QuoteDetail } from './requests';
import { GENERIC_ERROR } from '../lib/errorMessages';
import type { Vertical } from '../lib/vertical';

export interface ApproveQuoteResponse {
  quote: QuoteDetail;
}

export interface QuoteSummary {
  id: string;
  request_id: string;
  quote_number: string;
  status: 'draft' | 'approved' | 'ready' | 'sent';
  total_minor: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  pdf_ready: boolean;
  created_at: string;
  vertical: Vertical | null;
}

export const quoteKeys = {
  all: () => ['quotes'] as const,
  list: () => [...quoteKeys.all(), 'list'] as const,
};

export async function fetchQuotes(): Promise<QuoteSummary[]> {
  const res = await client.get<{ data: QuoteSummary[] }>('/quotes');
  return res.data.data;
}

export function useQuotes() {
  return useQuery({
    queryKey: quoteKeys.list(),
    queryFn: fetchQuotes,
    refetchInterval: 5000,
  });
}

export async function approveQuote(requestId: string): Promise<ApproveQuoteResponse> {
  const res = await client.post<{ data: ApproveQuoteResponse }>(`/requests/${requestId}/quote`);
  return res.data.data;
}

export type ApproveQuoteError = AxiosError<{ message?: string }>;

/**
 * Maps an approve-quote failure to display copy. Prefers the server's own message for 409/424
 * since the specific reason - not priced yet, the quote can't transition, the request itself
 * isn't approvable, or a reverted-to-DRAFT PDF failure - is backend-owned copy, not something
 * the client should re-derive from a status code alone.
 */
export function resolveApproveQuoteError(error: ApproveQuoteError): string {
  const status = error.response?.status;
  const serverMessage = error.response?.data?.message;
  if (status === 409) return serverMessage ?? 'Este orçamento não pode ser aprovado agora.';
  if (status === 424) return serverMessage ?? 'Não foi possível gerar o PDF. Tenta novamente.';
  if (status && status >= 400 && status < 500) return serverMessage ?? GENERIC_ERROR;
  return GENERIC_ERROR;
}

/** Approves and generates the quote (idempotent once READY); invalidates the request detail and
 * list caches so the Quote Output, Review, and Inbox screens all reflect the new approved status. */
export function useApproveQuote(requestId: string) {
  const queryClient = useQueryClient();

  return useMutation<ApproveQuoteResponse, ApproveQuoteError>({
    mutationFn: () => approveQuote(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestKeys.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: quoteKeys.list() });
    },
  });
}

export async function downloadQuotePdf(requestId: string): Promise<Blob> {
  const res = await client.get<Blob>(`/requests/${requestId}/quote/pdf`, {
    responseType: 'blob',
  });
  return res.data;
}
