import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';

/** One catalog SKU from the manual search (GET /catalog/skus, US-E6-2). */
export interface SkuSearchResult {
  sku_id: string;
  sku_code: string;
  name: string;
  description: string | null;
  base_price_minor: number;
  currency: string;
  lead_time_days: number | null;
  score: number;
}

export async function searchSkus(q: string): Promise<SkuSearchResult[]> {
  const res = await client.get<{ data: SkuSearchResult[] }>('/catalog/skus', { params: { q } });
  return res.data.data;
}

/** Searches the catalog; disabled (no request) until the query is non-empty. */
export function useSkuSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['catalog', 'skus', trimmed],
    queryFn: () => searchSkus(trimmed),
    enabled: trimmed.length > 0,
  });
}

export type EmbeddingStatus = 'ready' | 'pending' | 'unavailable';

/** One catalog SKU as managed in the admin CRUD (GET/POST/PATCH/DELETE /catalog/admin/skus). */
export interface Sku {
  id: string;
  sku_code: string;
  name: string;
  description: string | null;
  attributes: Record<string, unknown> | null;
  base_price_minor: number;
  cost_minor: number | null;
  currency: string;
  lead_time_days: number | null;
  active: boolean;
  embedding_status: EmbeddingStatus;
}

/** The writable fields of a SKU: same shape as Sku minus the server-owned id/embedding_status. */
export type SkuWritePayload = Omit<Sku, 'id' | 'embedding_status'>;

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  rejected: number;
  errors: ImportError[];
  embeddings: { ready: number; pending: number; unavailable: number };
}

export const adminSkuKeys = {
  all: () => ['catalog', 'admin', 'skus'] as const,
  list: () => [...adminSkuKeys.all(), 'list'] as const,
};

export async function fetchAdminSkus(): Promise<Sku[]> {
  const res = await client.get<{ data: Sku[] }>('/catalog/admin/skus');
  return res.data.data;
}

export function useAdminSkus() {
  return useQuery({ queryKey: adminSkuKeys.list(), queryFn: fetchAdminSkus });
}

export async function createSku(payload: SkuWritePayload): Promise<Sku> {
  const res = await client.post<{ data: Sku }>('/catalog/admin/skus', payload);
  return res.data.data;
}

export function useCreateSku() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSku,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSkuKeys.list() }),
  });
}

export async function updateSku(id: string, payload: Partial<SkuWritePayload>): Promise<Sku> {
  const res = await client.patch<{ data: Sku }>(`/catalog/admin/skus/${id}`, payload);
  return res.data.data;
}

export function useUpdateSku() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SkuWritePayload> }) =>
      updateSku(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSkuKeys.list() }),
  });
}

/** Deactivates (soft-deletes) a SKU; the backend never hard-deletes catalog rows. */
export async function deactivateSku(id: string): Promise<void> {
  await client.delete(`/catalog/admin/skus/${id}`);
}

export function useDeactivateSku() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateSku,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSkuKeys.list() }),
  });
}

export async function importCatalog(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post<{ data: ImportResult }>('/catalog/admin/import', form);
  return res.data.data;
}

export function useImportCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importCatalog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminSkuKeys.list() }),
  });
}
