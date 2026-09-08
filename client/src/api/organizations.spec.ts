import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import {
  fetchOrganizations,
  createOrganization,
  useCreateOrganization,
  organizationKeys,
} from './organizations';

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));

vi.mock('./client', () => ({
  default: { get: mockGet, post: mockPost },
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, invalidateSpy };
}

describe('fetchOrganizations', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('GETs /organizations and unwraps the data envelope', async () => {
    const orgs = [
      { id: 'org-avac', name: 'Clima Atlântico', vertical: 'avac' as const },
      { id: 'org-caixilharia', name: 'Vãos do Norte', vertical: 'caixilharia' as const },
    ];
    mockGet.mockResolvedValue({ data: { data: orgs } });

    const result = await fetchOrganizations();

    expect(mockGet).toHaveBeenCalledWith('/organizations');
    expect(result).toBe(orgs);
  });
});

describe('createOrganization', () => {
  beforeEach(() => mockPost.mockReset());

  it('POSTs name and vertical to /organizations/onboarding', async () => {
    const created = { id: 'org-new', name: 'Vãos do Sul', vertical: 'caixilharia' as const };
    mockPost.mockResolvedValue({ data: { data: created } });

    const result = await createOrganization({ name: 'Vãos do Sul', vertical: 'caixilharia' });

    expect(mockPost).toHaveBeenCalledWith('/organizations/onboarding', {
      name: 'Vãos do Sul',
      vertical: 'caixilharia',
    });
    expect(result).toEqual(created);
  });
});

describe('useCreateOrganization', () => {
  beforeEach(() => mockPost.mockReset());

  it('invalidates the organization list on success (org switcher must see the new org)', async () => {
    const { Wrapper, invalidateSpy } = makeWrapper();
    mockPost.mockResolvedValue({
      data: { data: { id: 'org-new', name: 'Vãos do Sul', vertical: 'caixilharia' } },
    });

    const { result } = renderHook(() => useCreateOrganization(), { wrapper: Wrapper });
    await act(async () => {
      result.current.mutate({ name: 'Vãos do Sul', vertical: 'caixilharia' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: organizationKeys.list() });
  });
});
