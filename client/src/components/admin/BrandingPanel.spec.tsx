import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrandingPanel } from './BrandingPanel';
import type { Branding } from '../../api/branding';

const {
  mockUseBranding,
  mockMutate,
  mockUseUpdateBranding,
  mockUploadMutate,
  mockUseUploadBrandingLogo,
} = vi.hoisted(() => ({
  mockUseBranding: vi.fn(),
  mockMutate: vi.fn(),
  mockUseUpdateBranding: vi.fn(),
  mockUploadMutate: vi.fn(),
  mockUseUploadBrandingLogo: vi.fn(),
}));

vi.mock('../../api/branding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/branding')>();
  return {
    ...actual,
    useBranding: () => mockUseBranding(),
    useUpdateBranding: () => mockUseUpdateBranding(),
    useUploadBrandingLogo: () => mockUseUploadBrandingLogo(),
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
    mockUseUploadBrandingLogo.mockReturnValue({
      mutate: mockUploadMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockMutate.mockReset();
    mockUploadMutate.mockReset();
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

  it('submits the edited IVA percentage converted back to a 0..1 rate, without a logo_url field', async () => {
    const user = userEvent.setup();
    renderPanel();

    const ivaInput = screen.getByLabelText(/^iva/i);
    await user.clear(ivaInput);
    await user.type(ivaInput, '6');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ iva_rate: 0.06, company_name: 'Clima Atlântico' }),
    );
    expect(mockMutate.mock.calls[0][0]).not.toHaveProperty('logo_url');
  });

  it('has no free-text field for the logo URL', () => {
    renderPanel();
    expect(screen.queryByLabelText(/url do logótipo/i)).not.toBeInTheDocument();
  });

  it('never renders a violet/purple/pink/rose/indigo class or a pill (rounded-full) shape', () => {
    const { container } = renderPanel();
    expect(container.innerHTML).not.toMatch(/violet|purple|pink|rose|indigo|rounded-full/);
  });
});

describe('BrandingPanel — logo upload', () => {
  beforeEach(() => {
    mockUseUpdateBranding.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseUploadBrandingLogo.mockReturnValue({
      mutate: mockUploadMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockMutate.mockReset();
    mockUploadMutate.mockReset();
  });

  it('shows a placeholder when there is no logo yet', () => {
    mockUseBranding.mockReturnValue({
      data: { ...branding, logo_url: null },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPanel();

    expect(screen.getByText(/sem logo/i)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /logótipo/i })).not.toBeInTheDocument();
  });

  it('shows the current logo image when one is set', () => {
    mockUseBranding.mockReturnValue({
      data: { ...branding, logo_url: 'https://cdn.example/logos/org-1.png' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPanel();

    expect(screen.getByRole('img', { name: /logótipo/i })).toHaveAttribute(
      'src',
      'https://cdn.example/logos/org-1.png',
    );
  });

  it('uploads a valid PNG file', async () => {
    mockUseBranding.mockReturnValue({
      data: { ...branding, logo_url: null },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPanel();

    const file = new File([new Uint8Array(1024)], 'logo.png', { type: 'image/png' });
    const input = screen.getByLabelText(/carregar logótipo/i) as HTMLInputElement;
    await user.upload(input, file);

    expect(mockUploadMutate).toHaveBeenCalledWith(file);
  });

  // fireEvent (not userEvent.upload) so the file reaches onChange regardless of user-event's own
  // accept-attribute simulation — the point of these two tests is this component's own validation.
  it('rejects an unsupported file type without uploading', () => {
    mockUseBranding.mockReturnValue({
      data: { ...branding, logo_url: null },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPanel();

    const file = new File([new Uint8Array(1024)], 'logo.gif', { type: 'image/gif' });
    const input = screen.getByLabelText(/carregar logótipo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockUploadMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/png|jpeg/i);
  });

  it('rejects an oversized file without uploading', () => {
    mockUseBranding.mockReturnValue({
      data: { ...branding, logo_url: null },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPanel();

    const oversized = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', {
      type: 'image/png',
    });
    const input = screen.getByLabelText(/carregar logótipo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [oversized] } });

    expect(mockUploadMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/2\s*MB/i);
  });
});
