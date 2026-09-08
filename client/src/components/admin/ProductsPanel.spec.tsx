import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductsPanel } from './ProductsPanel';
import type { Sku } from '../../api/catalog';

const {
  mockUseAdminSkus,
  mockCreateMutate,
  mockUpdateMutate,
  mockDeactivateMutate,
  mockImportMutate,
  mockUseCreateSku,
  mockUseUpdateSku,
  mockUseDeactivateSku,
  mockUseImportCatalog,
} = vi.hoisted(() => ({
  mockUseAdminSkus: vi.fn(),
  mockCreateMutate: vi.fn(),
  mockUpdateMutate: vi.fn(),
  mockDeactivateMutate: vi.fn(),
  mockImportMutate: vi.fn(),
  mockUseCreateSku: vi.fn(),
  mockUseUpdateSku: vi.fn(),
  mockUseDeactivateSku: vi.fn(),
  mockUseImportCatalog: vi.fn(),
}));

vi.mock('../../api/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/catalog')>();
  return {
    ...actual,
    useAdminSkus: () => mockUseAdminSkus(),
    useCreateSku: () => mockUseCreateSku(),
    useUpdateSku: () => mockUseUpdateSku(),
    useDeactivateSku: () => mockUseDeactivateSku(),
    useImportCatalog: () => mockUseImportCatalog(),
  };
});

const sku: Sku = {
  id: 'sku-1',
  sku_code: 'DAI-FTXM25',
  name: 'Daikin Perfera FTXM25',
  description: null,
  attributes: null,
  base_price_minor: 90000,
  cost_minor: 60000,
  currency: 'EUR',
  lead_time_days: 14,
  active: true,
  embedding_status: 'ready',
};

function renderPanel() {
  return render(<ProductsPanel />);
}

describe('ProductsPanel', () => {
  beforeEach(() => {
    mockUseAdminSkus.mockReturnValue({
      data: [sku],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseCreateSku.mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseUpdateSku.mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseDeactivateSku.mockReturnValue({
      mutate: mockDeactivateMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseImportCatalog.mockReturnValue({
      mutate: mockImportMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockCreateMutate.mockReset();
    mockUpdateMutate.mockReset();
    mockDeactivateMutate.mockReset();
    mockImportMutate.mockReset();
  });

  it('shows a loading state', () => {
    mockUseAdminSkus.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderPanel();
    expect(screen.getByText(/a carregar produtos/i)).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    const refetch = vi.fn();
    mockUseAdminSkus.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('lists SKUs with code, name, price in euros, and embedding status', () => {
    renderPanel();

    expect(screen.getByText('DAI-FTXM25')).toBeInTheDocument();
    expect(screen.getByText('Daikin Perfera FTXM25')).toBeInTheDocument();
    expect(screen.getByText('900,00 EUR')).toBeInTheDocument();
    expect(screen.getByText('Pronto')).toBeInTheDocument();
  });

  it('opens the create form and submits a euro price converted to minor units', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /novo produto/i }));
    await user.type(screen.getByLabelText(/código sku/i), 'DAI-FTXM35');
    await user.type(screen.getByLabelText(/^nome/i), 'Daikin Perfera FTXM35');
    await user.type(screen.getByLabelText(/preço de venda/i), '1100');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        sku_code: 'DAI-FTXM35',
        name: 'Daikin Perfera FTXM35',
        base_price_minor: 110000,
        currency: 'EUR',
        active: true,
      }),
      expect.anything(),
    );
  });

  it('opens the edit form pre-filled in euros and submits a PATCH with the id', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /editar daikin perfera ftxm25/i }));

    const priceInput = screen.getByLabelText(/preço de venda/i);
    expect(priceInput).toHaveValue(900);

    await user.clear(priceInput);
    await user.type(priceInput, '950');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sku-1',
        payload: expect.objectContaining({ base_price_minor: 95000 }),
      }),
      expect.anything(),
    );
  });

  it('requires confirmation before deactivating a SKU', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /desativar daikin perfera ftxm25/i }));
    expect(mockDeactivateMutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    expect(mockDeactivateMutate).toHaveBeenCalledWith('sku-1', expect.anything());
  });

  it('imports a catalog file and shows the summary', async () => {
    mockImportMutate.mockImplementation((_file, { onSuccess }) => {
      onSuccess({
        created: 3,
        updated: 1,
        rejected: 1,
        errors: [{ row: 5, message: 'Preço em falta' }],
        embeddings: { ready: 3, pending: 1, unavailable: 0 },
      });
    });
    const user = userEvent.setup();
    renderPanel();

    const file = new File(['a,b'], 'catalogo.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/importar catálogo/i) as HTMLInputElement;
    await user.upload(input, file);

    expect(mockImportMutate).toHaveBeenCalledWith(file, expect.anything());
    expect(screen.getByText(/3 criados/i)).toBeInTheDocument();
    expect(screen.getByText(/1 atualizados/i)).toBeInTheDocument();
    expect(screen.getByText(/1 rejeitados/i)).toBeInTheDocument();
    expect(screen.getByText(/linha 5/i)).toBeInTheDocument();
    expect(screen.getByText(/preço em falta/i)).toBeInTheDocument();
  });

  it('never renders a violet/purple/pink/rose/indigo class or a pill (rounded-full) shape, including inside the form modal', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();
    await user.click(screen.getByRole('button', { name: /novo produto/i }));

    expect(container.innerHTML).not.toMatch(/violet|purple|pink|rose|indigo|rounded-full/);
  });
});
