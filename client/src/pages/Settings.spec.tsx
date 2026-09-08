import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoleProvider } from '../context/RoleContext';
import { OrgProvider } from '../context/OrgContext';
import { getDemoOrgId } from '../api/demoOrg';
import { Settings } from './Settings';

const { mockUseOrganizations, mockCreateOrgMutate, mockUseCreateOrganization, mockNavigate } =
  vi.hoisted(() => ({
    mockUseOrganizations: vi.fn(),
    mockCreateOrgMutate: vi.fn(),
    mockUseCreateOrganization: vi.fn(),
    mockNavigate: vi.fn(),
  }));

vi.mock('../api/organizations', () => ({
  useOrganizations: () => mockUseOrganizations(),
  useCreateOrganization: () => mockUseCreateOrganization(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

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
    mockUseCreateOrganization.mockReturnValue({
      mutate: mockCreateOrgMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockCreateOrgMutate.mockReset();
    mockNavigate.mockReset();
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
});

describe('Settings — PT-PT copy', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseOrganizations.mockReturnValue({ data: orgs, isLoading: false });
    mockUseCreateOrganization.mockReturnValue({
      mutate: mockCreateOrgMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockCreateOrgMutate.mockReset();
    mockNavigate.mockReset();
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

describe('Settings — onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseOrganizations.mockReturnValue({ data: orgs, isLoading: false });
    mockUseCreateOrganization.mockReturnValue({
      mutate: mockCreateOrgMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockCreateOrgMutate.mockReset();
    mockNavigate.mockReset();
  });

  it('describes the guided next steps without claiming they are done', () => {
    renderSettings();

    expect(screen.getByText(/produtos.*regras.*branding.*pedido de teste/i)).toBeInTheDocument();
  });

  it('disables Criar organização until a name is entered', () => {
    renderSettings();

    expect(screen.getByRole('button', { name: /criar organização/i })).toBeDisabled();
  });

  it('creates the org, selects it, and navigates to the admin screen', async () => {
    const newOrg = { id: 'org-new', name: 'Vãos do Sul', vertical: 'caixilharia' as const };
    mockCreateOrgMutate.mockImplementation((_payload, { onSuccess }) => {
      // Mirrors what useCreateOrganization's own invalidateQueries would produce: the org list
      // refetch resolves with the new org included before onSuccess's caller acts on it.
      mockUseOrganizations.mockReturnValue({ data: [...orgs, newOrg], isLoading: false });
      onSuccess(newOrg);
    });
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText(/nome da organização/i), 'Vãos do Sul');
    await user.selectOptions(screen.getByLabelText(/vertical/i), 'caixilharia');
    await user.click(screen.getByRole('button', { name: /criar organização/i }));

    expect(mockCreateOrgMutate).toHaveBeenCalledWith(
      { name: 'Vãos do Sul', vertical: 'caixilharia' },
      expect.anything(),
    );
    expect(getDemoOrgId()).toBe('org-new');
    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
  });

  it('shows a readable error when creation fails', async () => {
    mockCreateOrgMutate.mockImplementation((_payload, { onError }) => {
      onError();
    });
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText(/nome da organização/i), 'Vãos do Sul');
    await user.click(screen.getByRole('button', { name: /criar organização/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
