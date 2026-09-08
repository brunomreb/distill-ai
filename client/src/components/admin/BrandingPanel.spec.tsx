import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrandingPanel } from './BrandingPanel';
import type { Branding } from '../../api/branding';

const { mockUseBranding, mockMutate, mockUseUpdateBranding } = vi.hoisted(() => ({
  mockUseBranding: vi.fn(),
  mockMutate: vi.fn(),
  mockUseUpdateBranding: vi.fn(),
}));

vi.mock('../../api/branding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/branding')>();
  return {
    ...actual,
    useBranding: () => mockUseBranding(),
    useUpdateBranding: () => mockUseUpdateBranding(),
  };
});

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

function renderPanel() {
  return render(<BrandingPanel />);
}

describe('BrandingPanel', () => {
  beforeEach(() => {
    mockUseBranding.mockReturnValue({
      data: branding,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseUpdateBranding.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockMutate.mockReset();
  });

  it('shows a loading state', () => {
    mockUseBranding.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderPanel();
    expect(screen.getByText(/a carregar branding/i)).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    const refetch = vi.fn();
    mockUseBranding.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('pre-fills the form with the current branding, IVA shown as a whole percentage', () => {
    renderPanel();

    expect(screen.getByLabelText(/nome da empresa/i)).toHaveValue('Clima Atlântico');
    expect(screen.getByLabelText(/nif/i)).toHaveValue('PT123456789');
    expect(screen.getByLabelText(/^iva/i)).toHaveValue(23);
  });

  it('submits the edited IVA percentage converted back to a 0..1 rate', async () => {
    const user = userEvent.setup();
    renderPanel();

    const ivaInput = screen.getByLabelText(/^iva/i);
    await user.clear(ivaInput);
    await user.type(ivaInput, '6');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ iva_rate: 0.06, company_name: 'Clima Atlântico' }),
    );
  });

  it('never renders a violet/purple/pink/rose/indigo class or a pill (rounded-full) shape', () => {
    const { container } = renderPanel();
    expect(container.innerHTML).not.toMatch(/violet|purple|pink|rose|indigo|rounded-full/);
  });
});
