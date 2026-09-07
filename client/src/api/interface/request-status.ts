// Mirrors the backend RequestStatus / RequestType enums (src/modules/requests/enums).
export type RequestStatus =
  | 'received'
  | 'parsing'
  | 'needs_review'
  | 'priced'
  | 'ready'
  | 'sent'
  | 'declined'
  | 'needs_clarification'
  | 'failed';

export type RequestType = 'catalog_rfq' | 'service_quote' | 'unknown';

export const requestStatusLabels: Record<RequestStatus, string> = {
  received: 'Recebido',
  parsing: 'Em processamento',
  needs_review: 'A rever',
  priced: 'Calculado',
  ready: 'Pronto',
  sent: 'Enviado',
  declined: 'Recusado',
  needs_clarification: 'A esclarecer',
  failed: 'Falhou',
};

/** Runtime guard: true when `value` is one of the known RequestStatus values. */
export function isRequestStatus(value: string): value is RequestStatus {
  return Object.prototype.hasOwnProperty.call(requestStatusLabels, value);
}

// Hand-mirrors the backend's QUOTE_APPROVABLE_STATUSES allowlist
// (src/modules/requests/constants/quote-approval.constants.ts) - update both together.
export const QUOTE_APPROVABLE_STATUSES: readonly RequestStatus[] = ['priced', 'needs_review'];

export const requestTypeLabels: Record<RequestType, string> = {
  catalog_rfq: 'Pedido de orçamento',
  service_quote: 'Orçamento de serviço',
  unknown: 'Desconhecido',
};

/** Runtime guard: true when `value` is one of the known RequestType values. */
export function isRequestType(value: string): value is RequestType {
  return Object.prototype.hasOwnProperty.call(requestTypeLabels, value);
}
