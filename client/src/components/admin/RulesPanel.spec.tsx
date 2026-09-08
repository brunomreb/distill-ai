import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesPanel } from './RulesPanel';
import type { Rule } from '../../api/pricingRules';

const {
  mockUseRules,
  mockCreateMutate,
  mockUpdateMutate,
  mockDeleteMutate,
  mockUseCreateRule,
  mockUseUpdateRule,
  mockUseDeleteRule,
} = vi.hoisted(() => ({
  mockUseRules: vi.fn(),
  mockCreateMutate: vi.fn(),
  mockUpdateMutate: vi.fn(),
  mockDeleteMutate: vi.fn(),
  mockUseCreateRule: vi.fn(),
  mockUseUpdateRule: vi.fn(),
  mockUseDeleteRule: vi.fn(),
}));

vi.mock('../../api/pricingRules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/pricingRules')>();
  return {
    ...actual,
    useRules: () => mockUseRules(),
    useCreateRule: () => mockUseCreateRule(),
    useUpdateRule: () => mockUseUpdateRule(),
    useDeleteRule: () => mockUseDeleteRule(),
  };
});

const rule: Rule = {
  id: 'rule-1',
  vertical: 'avac',
  rule_key: 'pipe_extra',
  rule_type: 'conditional_surcharge',
  config: { threshold: 3, price_per_unit_over: 14.5, unit: 'm' },
  sort_order: 2,
  active: true,
};

function renderPanel() {
  return render(<RulesPanel />);
}

describe('RulesPanel', () => {
  beforeEach(() => {
    mockUseRules.mockReturnValue({
      data: [rule],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseCreateRule.mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseUpdateRule.mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseDeleteRule.mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockCreateMutate.mockReset();
    mockUpdateMutate.mockReset();
    mockDeleteMutate.mockReset();
  });

  it('shows a loading state', () => {
    mockUseRules.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderPanel();
    expect(screen.getByText(/a carregar regras/i)).toBeInTheDocument();
  });

  it('lists rules with vertical, key, type, and sort order', () => {
    renderPanel();

    expect(screen.getByText('pipe_extra')).toBeInTheDocument();
    expect(screen.getByText('AVAC')).toBeInTheDocument();
    expect(screen.getByText(/sobretaxa condicional/i)).toBeInTheDocument();
  });

  it('opens the create form and submits a valid JSON config', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /nova regra/i }));
    await user.type(screen.getByLabelText(/chave da regra/i), 'labor_rate');
    fireEvent.change(screen.getByLabelText(/configuração/i), { target: { value: '{"rate": 30}' } });
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        rule_key: 'labor_rate',
        config: { rate: 30 },
        active: true,
      }),
      expect.anything(),
    );
  });

  it('shows a readable error and blocks submit when the config JSON is invalid', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /nova regra/i }));
    await user.type(screen.getByLabelText(/chave da regra/i), 'labor_rate');
    fireEvent.change(screen.getByLabelText(/configuração/i), { target: { value: '{rate: 30}' } });
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/inválido/i);
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('opens the edit form pre-filled with the existing config', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /editar pipe_extra/i }));

    const configField = screen.getByLabelText(/configuração/i);
    expect(configField).toHaveValue(JSON.stringify(rule.config, null, 2));

    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rule-1',
        payload: expect.objectContaining({ rule_key: 'pipe_extra' }),
      }),
      expect.anything(),
    );
  });

  it('offers qty_break as a selectable rule type (caixilharia area discounts)', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /nova regra/i }));

    expect(
      within(screen.getByLabelText(/tipo de regra/i)).getByRole('option', {
        name: /escalões de quantidade/i,
      }),
    ).toBeInTheDocument();
  });

  it('requires confirmation before deleting a rule', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /remover pipe_extra/i }));
    expect(mockDeleteMutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }));

    expect(mockDeleteMutate).toHaveBeenCalledWith('rule-1', expect.anything());
  });

  it('never renders a violet/purple/pink/rose/indigo class or a pill (rounded-full) shape', () => {
    const { container } = renderPanel();
    expect(container.innerHTML).not.toMatch(/violet|purple|pink|rose|indigo|rounded-full/);
  });
});
