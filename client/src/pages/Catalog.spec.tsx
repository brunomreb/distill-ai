import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Catalog } from './Catalog';

vi.mock('../components/admin/ProductsPanel', () => ({
  ProductsPanel: () => <div>Produtos panel</div>,
}));
vi.mock('../components/admin/RulesPanel', () => ({
  RulesPanel: () => <div>Regras panel</div>,
}));
vi.mock('../components/admin/BrandingPanel', () => ({
  BrandingPanel: () => <div>Branding panel</div>,
}));

describe('Catalog', () => {
  it('shows the Produtos panel by default', () => {
    render(<Catalog />);

    expect(screen.getByRole('tab', { name: 'Produtos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Produtos panel')).toBeInTheDocument();
    expect(screen.queryByText('Regras panel')).not.toBeInTheDocument();
  });

  it('switches to the Regras panel', async () => {
    const user = userEvent.setup();
    render(<Catalog />);

    await user.click(screen.getByRole('tab', { name: 'Regras' }));

    expect(screen.getByRole('tab', { name: 'Regras' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Regras panel')).toBeInTheDocument();
    expect(screen.queryByText('Produtos panel')).not.toBeInTheDocument();
  });

  it('switches to the Branding panel', async () => {
    const user = userEvent.setup();
    render(<Catalog />);

    await user.click(screen.getByRole('tab', { name: 'Branding' }));

    expect(screen.getByText('Branding panel')).toBeInTheDocument();
  });

  it('never renders a violet/purple/pink/rose class', () => {
    const { container } = render(<Catalog />);
    expect(container.innerHTML).not.toMatch(/violet|purple|pink|rose/);
  });
});
