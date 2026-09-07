import { render, screen } from '@testing-library/react';
import { VerticalBadge } from './VerticalBadge';

describe('VerticalBadge', () => {
  it('renders the AVAC label for the avac vertical', () => {
    render(<VerticalBadge vertical="avac" />);
    expect(screen.getByText('AVAC')).toBeInTheDocument();
  });

  it('renders the Caixilharia label for the caixilharia vertical', () => {
    render(<VerticalBadge vertical="caixilharia" />);
    expect(screen.getByText('Caixilharia')).toBeInTheDocument();
  });

  it('renders nothing when the vertical is null', () => {
    const { container } = render(<VerticalBadge vertical={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Brand rule: no SaaS pill shape — small approved radius only, never fully rounded.
  it('never uses the pill (rounded-full) shape', () => {
    render(<VerticalBadge vertical="avac" />);
    const badge = screen.getByText('AVAC');
    expect(badge.className).not.toMatch(/rounded-full/);
  });
});
