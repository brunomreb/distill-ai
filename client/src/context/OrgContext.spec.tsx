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

  it('drops a stored org id that no longer matches a known org', () => {
    localStorage.setItem(STORAGE_KEY, 'org-deleted');

    renderConsumer();

    expect(screen.getByTestId('selected')).toHaveTextContent('none');
    expect(getDemoOrgId()).toBeNull();
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
});
