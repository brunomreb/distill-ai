import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { BrandingPanel } from './BrandingPanel';
import type { Branding } from '../../api/branding';

const {
  mockUseBranding,
  mockMutate,
  mockUseUpdateBranding,
  mockUploadMutate,
  mockUseUploadBrandingLogo,
  mockUseBrandingLogo,
} = vi.hoisted(() => ({
  mockUseBranding: vi.fn(),
  mockMutate: vi.fn(),
  mockUseUpdateBranding: vi.fn(),
  mockUploadMutate: vi.fn(),
  mockUseUploadBrandingLogo: vi.fn(),
  mockUseBrandingLogo: vi.fn(),
}));

vi.mock('../../api/branding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/branding')>();
  return {
    ...actual,
    useBranding: () => mockUseBranding(),
    useUpdateBranding: () => mockUseUpdateBranding(),
    useUploadBrandingLogo: () => mockUseUploadBrandingLogo(),
    useBrandingLogo: (options: Parameters<typeof actual.useBrandingLogo>[0]) =>
      mockUseBrandingLogo(options),
  };
});

// jsdom has no object-URL implementation; the component must still get a stable string back.
const createObjectURL = vi.fn(() => 'blob:mock-logo-url');
const revokeObjectURL = vi.fn();
vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

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
    mockUseBrandingLogo.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mockMutate.mockReset();
    mockUploadMutate.mockReset();
    mockUseBrandingLogo.mockClear();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
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
    mockUseBrandingLogo.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mockMutate.mockReset();
    mockUploadMutate.mockReset();
    mockUseBrandingLogo.mockClear();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
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
    // logo_url is a private object-store key — never fetched when there's nothing to show.
    expect(mockUseBrandingLogo).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('never uses the raw logo_url as the img src — fetches the blob and renders an object URL', () => {
    mockUseBranding.mockReturnValue({
      data: { ...branding, logo_url: 'org-store-keys/logo-1' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const blob = new Blob(['PNGDATA'], { type: 'image/png' });
    mockUseBrandingLogo.mockReturnValue({ data: blob, isLoading: false, isError: false });

    renderPanel();

    expect(mockUseBrandingLogo).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    const img = screen.getByRole('img', { name: /logótipo/i });
    expect(img).toHaveAttribute('src', 'blob:mock-logo-url');
    expect(img).not.toHaveAttribute('src', 'org-store-keys/logo-1');
  });

  it('revokes the object URL on unmount to avoid leaking it', () => {
    mockUseBranding.mockReturnValue({
      data: { ...branding, logo_url: 'org-store-keys/logo-1' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const blob = new Blob(['PNGDATA'], { type: 'image/png' });
    mockUseBrandingLogo.mockReturnValue({ data: blob, isLoading: false, isError: false });

    const { unmount } = renderPanel();
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-logo-url');
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

    expect(mockUploadMutate.mock.calls[0][0]).toBe(file);
  });

  it('bumps the cache-bust key and refetches after a successful upload', async () => {
    mockUseBranding.mockReturnValue({
      data: { ...branding, logo_url: 'org-store-keys/logo-1' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseBrandingLogo.mockReturnValue({
      data: new Blob(['PNGDATA'], { type: 'image/png' }),
      isLoading: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderPanel();

    expect(mockUseBrandingLogo).toHaveBeenLastCalledWith(expect.objectContaining({ cacheBust: 0 }));

    const file = new File([new Uint8Array(1024)], 'logo.png', { type: 'image/png' });
    const input = screen.getByLabelText(/carregar logótipo/i) as HTMLInputElement;
    await user.upload(input, file);

    const onSuccess = mockUploadMutate.mock.calls[0][1]?.onSuccess as () => void;
    act(() => onSuccess());

    expect(mockUseBrandingLogo).toHaveBeenLastCalledWith(expect.objectContaining({ cacheBust: 1 }));
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
