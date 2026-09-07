import type { QuoteStatus } from '../enums/quote-status.enum';

/** Compact organization-scoped read model for the quote register. */
export interface QuoteSummary {
  id: string;
  request_id: string;
  quote_number: string;
  status: QuoteStatus;
  total_minor: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  pdf_ready: boolean;
  created_at: Date;
}
