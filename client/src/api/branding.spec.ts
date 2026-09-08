import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import {
  brandingKeys,
  fetchBranding,
  updateBranding,
  useUpdateBranding,
  uploadBrandingLogo,
  useUploadBrandingLogo,
  validateLogoFile,
  MAX_LOGO_BYTES,
} from './branding';
import type { Branding } from './branding';

const { mockGet, mockPatch, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('./client', () => ({
  default: { get: mockGet, patch: mockPatch, post: mockPost },
}));

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

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

describe('uploadBrandingLogo', () => {
  beforeEach(() => mockPost.mockReset());

  it('POSTs the file as multipart form-data under field "file" to the logo endpoint', async () => {
    const uploaded: Branding = { ...branding, logo_url: 'https://cdn.example/logos/org-1.png' };
    mockPost.mockResolvedValue({ data: { data: uploaded } });
    const file = makeFile('logo.png', 'image/png', 1024);

    const result = await uploadBrandingLogo(file);

    expect(mockPost).toHaveBeenCalledOnce();
    const [url, body] = mockPost.mock.calls[0] as [string, FormData];
    expect(url).toBe('/organizations/current/branding/logo');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBe(file);
    expect(result).toEqual(uploaded);
  });
});

describe('useUploadBrandingLogo', () => {
  beforeEach(() => mockPost.mockReset());

  it('invalidates the branding query on success', async () => {
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockPost.mockResolvedValue({ data: { data: branding } });

    const { result } = renderHook(() => useUploadBrandingLogo(), {
      wrapper: makeWrapper(queryClient),
    });
    await act(async () => {
      result.current.mutate(makeFile('logo.png', 'image/png', 1024));
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: brandingKeys.all() });
  });
});

describe('validateLogoFile', () => {
  it('accepts a PNG within the size limit', () => {
    expect(validateLogoFile(makeFile('logo.png', 'image/png', 1024))).toBeNull();
  });

  it('accepts a JPEG within the size limit', () => {
    expect(validateLogoFile(makeFile('logo.jpg', 'image/jpeg', 1024))).toBeNull();
  });

  it('accepts a file exactly at the 2 MB boundary', () => {
    expect(validateLogoFile(makeFile('logo.png', 'image/png', MAX_LOGO_BYTES))).toBeNull();
  });

  it('rejects a file one byte over the 2 MB limit with a PT-PT message', () => {
    const error = validateLogoFile(makeFile('logo.png', 'image/png', MAX_LOGO_BYTES + 1));
    expect(error).toMatch(/2\s*MB/i);
  });

  it('rejects an unsupported mime type with a PT-PT message', () => {
    const error = validateLogoFile(makeFile('logo.gif', 'image/gif', 1024));
    expect(error).toMatch(/png|jpeg/i);
  });
});
