import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import {
  searchSkus,
  adminSkuKeys,
  fetchAdminSkus,
  createSku,
  updateSku,
  deactivateSku,
  importCatalog,
  useCreateSku,
  useDeactivateSku,
  useImportCatalog,
} from './catalog';
import type { SkuWritePayload } from './catalog';

const { mockGet, mockPost, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('./client', () => ({
  default: { get: mockGet, post: mockPost, patch: mockPatch, delete: mockDelete },
}));

const sku = {
  id: 'sku-1',
  sku_code: 'DAI-FTXM25',
  name: 'Daikin Perfera FTXM25',
  description: null,
  attributes: null,
  base_price_minor: 90000,
  cost_minor: 60000,
  currency: 'EUR',
  lead_time_days: 14,
  active: true,
  embedding_status: 'ready' as const,
};

const writePayload: SkuWritePayload = {
  sku_code: 'DAI-FTXM25',
  name: 'Daikin Perfera FTXM25',
  description: null,
  attributes: null,
  base_price_minor: 90000,
  cost_minor: 60000,
  currency: 'EUR',
  lead_time_days: 14,
  active: true,
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('adminSkuKeys', () => {
  it('list() nests under all()', () => {
    expect(adminSkuKeys.list()).toEqual([...adminSkuKeys.all(), 'list']);
  });
});

describe('searchSkus (existing matching endpoint, unaffected by admin CRUD)', () => {
  beforeEach(() => mockGet.mockReset());

  it('still GETs /catalog/skus', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });
    await searchSkus('bolt');
    expect(mockGet).toHaveBeenCalledWith('/catalog/skus', { params: { q: 'bolt' } });
  });
});

describe('fetchAdminSkus', () => {
  beforeEach(() => mockGet.mockReset());

  it('GETs /catalog/admin/skus and unwraps the data envelope', async () => {
    mockGet.mockResolvedValue({ data: { data: [sku] } });
    const result = await fetchAdminSkus();
    expect(mockGet).toHaveBeenCalledWith('/catalog/admin/skus');
    expect(result).toEqual([sku]);
  });
});

describe('createSku', () => {
  beforeEach(() => mockPost.mockReset());

  it('POSTs the write payload (no id/embedding_status) to /catalog/admin/skus', async () => {
    mockPost.mockResolvedValue({ data: { data: sku } });
    const result = await createSku(writePayload);
    expect(mockPost).toHaveBeenCalledWith('/catalog/admin/skus', writePayload);
    expect(result).toEqual(sku);
  });
});

describe('updateSku', () => {
  beforeEach(() => mockPatch.mockReset());

  it('PATCHes a partial payload to /catalog/admin/skus/:id', async () => {
    mockPatch.mockResolvedValue({ data: { data: { ...sku, active: false } } });
    const result = await updateSku('sku-1', { active: false });
    expect(mockPatch).toHaveBeenCalledWith('/catalog/admin/skus/sku-1', { active: false });
    expect(result.active).toBe(false);
  });
});

describe('deactivateSku', () => {
  beforeEach(() => mockDelete.mockReset());

  it('DELETEs /catalog/admin/skus/:id', async () => {
    mockDelete.mockResolvedValue({});
    await deactivateSku('sku-1');
    expect(mockDelete).toHaveBeenCalledWith('/catalog/admin/skus/sku-1');
  });
});

describe('importCatalog', () => {
  beforeEach(() => mockPost.mockReset());

  it('POSTs the file as multipart form-data under field "file"', async () => {
    const importResult = {
      created: 3,
      updated: 1,
      rejected: 1,
      errors: [{ row: 5, message: 'Preço em falta' }],
      embeddings: { ready: 3, pending: 1, unavailable: 0 },
    };
    mockPost.mockResolvedValue({ data: { data: importResult } });
    const file = new File(['a,b'], 'catalogo.csv', { type: 'text/csv' });

    const result = await importCatalog(file);

    expect(mockPost).toHaveBeenCalledOnce();
    const [url, body] = mockPost.mock.calls[0] as [string, FormData];
    expect(url).toBe('/catalog/admin/import');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBe(file);
    expect(result).toEqual(importResult);
  });
});

describe('useCreateSku', () => {
  beforeEach(() => mockPost.mockReset());

  it('invalidates the admin sku list on success', async () => {
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockPost.mockResolvedValue({ data: { data: sku } });

    const { result } = renderHook(() => useCreateSku(), { wrapper: makeWrapper(queryClient) });
    await act(async () => {
      result.current.mutate(writePayload);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminSkuKeys.list() });
  });
});

describe('useDeactivateSku', () => {
  beforeEach(() => mockDelete.mockReset());

  it('invalidates the admin sku list on success', async () => {
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockDelete.mockResolvedValue({});

    const { result } = renderHook(() => useDeactivateSku(), { wrapper: makeWrapper(queryClient) });
    await act(async () => {
      result.current.mutate('sku-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminSkuKeys.list() });
  });
});

describe('useImportCatalog', () => {
  beforeEach(() => mockPost.mockReset());

  it('invalidates the admin sku list on success', async () => {
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockPost.mockResolvedValue({
      data: {
        data: {
          created: 1,
          updated: 0,
          rejected: 0,
          errors: [],
          embeddings: { ready: 1, pending: 0, unavailable: 0 },
        },
      },
    });

    const { result } = renderHook(() => useImportCatalog(), { wrapper: makeWrapper(queryClient) });
    await act(async () => {
      result.current.mutate(new File(['a'], 'x.csv'));
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminSkuKeys.list() });
  });
});
