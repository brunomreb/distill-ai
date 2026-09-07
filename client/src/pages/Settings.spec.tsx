import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoleProvider } from '../context/RoleContext';
import { OrgProvider } from '../context/OrgContext';
import { getDemoOrgId } from '../api/demoOrg';
import { Settings } from './Settings';

const { mockUseOrganizations } = vi.hoisted(() => ({ mockUseOrganizations: vi.fn() }));

vi.mock('../api/organizations', () => ({
  useOrganizations: () => mockUseOrganizations(),
}));

const orgs = [
  { id: 'org-avac', name: 'Clima Atlântico', vertical: 'avac' as const },
  { id: 'org-caixilharia', name: 'Vãos do Norte', vertical: 'caixilharia' as const },
];

function renderSettings() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RoleProvider>
          <OrgProvider>
            <Settings />
          </OrgProvider>
        </RoleProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Settings — demo org switcher', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseOrganizations.mockReturnValue({ data: orgs, isLoading: false });
  });

  it('lists each demo org with its vertical', () => {
    renderSettings();

    expect(screen.getByText(/Clima Atlântico/)).toBeInTheDocument();
    expect(screen.getByText(/Vãos do Norte/)).toBeInTheDocument();
  });

  it('selects an org and injects its id into subsequent requests', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('radio', { name: /vãos do norte/i }));

    expect(getDemoOrgId()).toBe('org-caixilharia');
  });

  it('shows a loading message while the org list is loading', () => {
    mockUseOrganizations.mockReturnValue({ data: undefined, isLoading: true });

    renderSettings();

    expect(screen.getByText(/a carregar organizações/i)).toBeInTheDocument();
  });
});

describe('Settings — PT-PT copy', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseOrganizations.mockReturnValue({ data: orgs, isLoading: false });
  });

  it('shows the page title and section headings in PT-PT', () => {
    renderSettings();

    expect(screen.getByRole('heading', { name: 'Definições' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Papel de demonstração' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Limiares de confiança' })).toBeInTheDocument();
  });

  it('shows the selected role description in PT-PT', () => {
    renderSettings();

    expect(screen.getByText(/persona de demonstração: avery reed/i)).toBeInTheDocument();
  });

  it('shows the threshold labels in PT-PT', () => {
    renderSettings();

    expect(screen.getByText('Limiar de aprovação automática')).toBeInTheDocument();
    expect(screen.getByText('Limiar de revisão')).toBeInTheDocument();
    expect(screen.getByText('Limite de envio automático')).toBeInTheDocument();
  });

  it('has no leftover English copy on the page', () => {
    const { container } = renderSettings();

    expect(container.textContent).not.toMatch(/Settings|Demo role|Switch persona|Confidence/i);
  });
});
