import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrgProvider, STORAGE_KEY } from './OrgContext';
import { useOrg } from '../hooks/useOrg';
import { getDemoOrgId } from '../api/demoOrg';

const { mockUseOrganizations } = vi.hoisted(() => ({ mockUseOrganizations: vi.fn() }));

vi.mock('../api/organizations', () => ({
  useOrganizations: () => mockUseOrganizations(),
}));

const orgs = [
  { id: 'org-avac', name: 'Clima Atlântico', vertical: 'avac' as const },
  { id: 'org-caixilharia', name: 'Vãos do Norte', vertical: 'caixilharia' as const },
];

function Consumer() {
  const { organizations, selectedOrgId, setSelectedOrgId, isLoading } = useOrg();
  if (isLoading) return <p>A carregar…</p>;
  return (
    <div>
      <p data-testid="selected">{selectedOrgId ?? 'none'}</p>
      {organizations.map((org) => (
        <button key={org.id} onClick={() => setSelectedOrgId(org.id)}>
          {org.name}
        </button>
      ))}
    </div>
  );
}

function renderConsumer(queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <OrgProvider>
        <Consumer />
      </OrgProvider>
    </QueryClientProvider>,
  );
}

describe('OrgProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseOrganizations.mockReturnValue({ data: orgs, isLoading: false });
  });

  it('starts with no org selected when nothing is stored', () => {
    renderConsumer();
    expect(screen.getByTestId('selected')).toHaveTextContent('none');
    expect(getDemoOrgId()).toBeNull();
  });

  it('restores a previously selected org from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'org-caixilharia');

    renderConsumer();

    expect(screen.getByTestId('selected')).toHaveTextContent('org-caixilharia');
    expect(getDemoOrgId()).toBe('org-caixilharia');
  });

  it('drops a stored org id that no longer matches a known org, clearing storage and the header', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    localStorage.setItem(STORAGE_KEY, 'org-deleted');

    renderConsumer(queryClient);

    expect(screen.getByTestId('selected')).toHaveTextContent('none');
    expect(getDemoOrgId()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('persists the selection, injects the header, and invalidates queries', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    renderConsumer(queryClient);

    await user.click(screen.getByRole('button', { name: 'Vãos do Norte' }));

    expect(screen.getByTestId('selected')).toHaveTextContent('org-caixilharia');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('org-caixilharia');
    expect(getDemoOrgId()).toBe('org-caixilharia');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  // Regression: the header used to be set from a useEffect while invalidateQueries fired
  // synchronously from the click handler, so refetches could race ahead of the new header.
  it('applies the demo org header before invalidating queries on selection change', async () => {
    const queryClient = new QueryClient();
    const orgIdSeenByInvalidate: Array<string | null> = [];
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => {
      orgIdSeenByInvalidate.push(getDemoOrgId());
      return Promise.resolve();
    });
    const user = userEvent.setup();
    renderConsumer(queryClient);
    orgIdSeenByInvalidate.length = 0; // mount invalidates too; isolate the click's own invalidation

    await user.click(screen.getByRole('button', { name: 'Vãos do Norte' }));

    expect(orgIdSeenByInvalidate).toEqual(['org-caixilharia']);
  });
});

describe('OrgProvider — module-load priming', () => {
  afterEach(() => {
    localStorage.clear();
  });

  // Regression: on a hard reload with a persisted org, children used to mount (and fire their
  // first queries) before the provider's effect had applied the header. Priming happens as a
  // module-level side effect, so it must already be in place the instant anything imports the
  // module — well before <OrgProvider> itself, let alone its children, ever renders.
  it('primes the demo org header from localStorage the moment the module loads, before any component mounts', async () => {
    localStorage.setItem(STORAGE_KEY, 'org-caixilharia');
    vi.resetModules();

    const demoOrg = await import('../api/demoOrg');
    expect(demoOrg.getDemoOrgId()).toBeNull();

    await import('./OrgContext');

    expect(demoOrg.getDemoOrgId()).toBe('org-caixilharia');
  });
});
