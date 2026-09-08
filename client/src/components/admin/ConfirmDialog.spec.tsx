import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Desativar SKU"
        message="Tens a certeza?"
        confirmLabel="Desativar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title, message, and confirm label when open', () => {
    render(
      <ConfirmDialog
        open
        title="Desativar SKU"
        message="Tens a certeza? Esta ação não pode ser desfeita."
        confirmLabel="Desativar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Desativar SKU' })).toBeInTheDocument();
    expect(screen.getByText(/tens a certeza/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Desativar SKU"
        message="Tens a certeza?"
        confirmLabel="Desativar"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Desativar' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Desativar SKU"
        message="Tens a certeza?"
        confirmLabel="Desativar"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel on Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Desativar SKU"
        message="Tens a certeza?"
        confirmLabel="Desativar"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('never renders a violet/purple/pink/rose class or a pill (rounded-full) shape', () => {
    render(
      <ConfirmDialog
        open
        title="Desativar SKU"
        message="Tens a certeza?"
        confirmLabel="Desativar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.innerHTML).not.toMatch(/violet|purple|pink|rose|rounded-full/);
  });
});
