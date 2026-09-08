import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { brandingKeys, fetchBranding, updateBranding, useUpdateBranding } from './branding';
import type { Branding } from './branding';

const { mockGet, mockPatch } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPatch: vi.fn() }));

vi.mock('./client', () => ({
  default: { get: mockGet, patch: mockPatch },
}));

const branding: Branding = {
  company_name: 'Clima Atlântico',
  logo_url: null,
  primary_color: '#5eead4',
  vat_number: 'PT123456789',
  address: 'Câmara de Lobos',
  footer_text: 'Obrigado pela preferência.',
  iva_rate: 0.23,
  email: 'geral@climaatlantico.pt',
  phone: '+351910000000',
  quote_validity_days: 30,
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

describe('fetchBranding', () => {
  beforeEach(() => mockGet.mockReset());

  it('GETs /organizations/current/branding and unwraps the data envelope, IVA as 0..1', async () => {
    mockGet.mockResolvedValue({ data: { data: branding } });
    const result = await fetchBranding();
    expect(mockGet).toHaveBeenCalledWith('/organizations/current/branding');
    expect(result.iva_rate).toBe(0.23);
  });
});

describe('updateBranding', () => {
  beforeEach(() => mockPatch.mockReset());

  it('PATCHes /organizations/current/branding with a 0..1 iva_rate', async () => {
    mockPatch.mockResolvedValue({ data: { data: { ...branding, iva_rate: 0.06 } } });
    const result = await updateBranding({ iva_rate: 0.06 });
    expect(mockPatch).toHaveBeenCalledWith('/organizations/current/branding', { iva_rate: 0.06 });
    expect(result.iva_rate).toBe(0.06);
  });
});

describe('useUpdateBranding', () => {
  beforeEach(() => mockPatch.mockReset());

  it('invalidates the branding query on success', async () => {
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockPatch.mockResolvedValue({ data: { data: branding } });

    const { result } = renderHook(() => useUpdateBranding(), { wrapper: makeWrapper(queryClient) });
    await act(async () => {
      result.current.mutate({ company_name: 'Clima Atlântico' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: brandingKeys.all() });
  });
});
