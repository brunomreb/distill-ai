import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
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

function Consumer({ onMountEffect }: { onMountEffect?: () => void }) {
  const { organizations, selectedOrgId, setSelectedOrgId } = useOrg();
  // Mirrors a child's own data-fetch effect, to observe the header at the moment children first appear.
  useEffect(() => {
    onMountEffect?.();
  }, [onMountEffect]);
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

function renderConsumer(queryClient = new QueryClient(), onMountEffect?: () => void) {
  return render(
    <QueryClientProvider client={queryClient}>
      <OrgProvider>
        <Consumer onMountEffect={onMountEffect} />
      </OrgProvider>
    </QueryClientProvider>,
  );
}

describe('OrgProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseOrganizations.mockReturnValue({ data: orgs, isLoading: false });
  });

  it('blocks children while the organization list is still loading', () => {
    mockUseOrganizations.mockReturnValue({ data: undefined, isLoading: true });

    renderConsumer();

    expect(screen.queryByTestId('selected')).not.toBeInTheDocument();
    expect(screen.getByText(/a validar organização/i)).toBeInTheDocument();
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
    localStorage.setItem(STORAGE_KEY, 'org-deleted');

    renderConsumer();

    expect(screen.getByTestId('selected')).toHaveTextContent('none');
    expect(getDemoOrgId()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // Regression: children (and their first requests) used to mount before a post-commit effect
  // had corrected the header for a stale persisted org. The header is now corrected synchronously
  // during the same render that decides organizations are validated — the same render that first
  // lets children exist — so no child's own mount effect can ever observe the stale value.
  it('never lets a child observe the stale header, even in its own mount effect', () => {
    localStorage.setItem(STORAGE_KEY, 'org-deleted');
    const headerSeenOnMount: Array<string | null> = [];

    renderConsumer(new QueryClient(), () => headerSeenOnMount.push(getDemoOrgId()));

    expect(headerSeenOnMount).toEqual([null]);
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
  // synchronously from the click handler, so refetches could race ahead of the new header. The
  // click handler now sets the header synchronously, in the same function, before invalidating.
  it('applies the demo org header before invalidating queries on selection change', async () => {
    const queryClient = new QueryClient();
    const orgIdSeenByInvalidate: Array<string | null> = [];
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => {
      orgIdSeenByInvalidate.push(getDemoOrgId());
      return Promise.resolve();
    });
    const user = userEvent.setup();
    renderConsumer(queryClient);

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
