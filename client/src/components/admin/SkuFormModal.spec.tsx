import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkuFormModal } from './SkuFormModal';

function renderModal(onSubmit = vi.fn()) {
  render(
    <SkuFormModal
      open
      initial={null}
      onSubmit={onSubmit}
      onClose={vi.fn()}
      isPending={false}
      error={null}
    />,
  );
  return onSubmit;
}

describe('SkuFormModal currency', () => {
  it('shows EUR as a fixed, non-editable value', () => {
    renderModal();

    expect(screen.getByText('EUR (€)')).toBeInTheDocument();
    expect(screen.queryByLabelText(/moeda/i)).not.toBeInTheDocument();
  });

  it('always submits currency EUR', async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    await user.type(screen.getByLabelText(/código sku/i), 'SKU-1');
    await user.type(screen.getByLabelText(/^nome/i), 'Item');
    await user.type(screen.getByLabelText(/preço de venda/i), '10');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: 'EUR' }));
  });
});
