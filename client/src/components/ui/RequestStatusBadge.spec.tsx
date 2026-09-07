import { render, screen } from '@testing-library/react';
import { RequestStatusBadge } from './RequestStatusBadge';
import type { RequestStatus } from '../../api/interface/request-status';

const cases: { status: RequestStatus; label: string }[] = [
  { status: 'received', label: 'Recebido' },
  { status: 'parsing', label: 'Em processamento' },
  { status: 'needs_review', label: 'A rever' },
  { status: 'priced', label: 'Calculado' },
  { status: 'ready', label: 'Pronto' },
  { status: 'sent', label: 'Enviado' },
  { status: 'declined', label: 'Recusado' },
  { status: 'needs_clarification', label: 'A esclarecer' },
  { status: 'failed', label: 'Falhou' },
];

describe('RequestStatusBadge', () => {
  it.each(cases)('renders the "$label" label for status $status', ({ status, label }) => {
    render(<RequestStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('applies the parsing palette and a pulsing dot for parsing', () => {
    const { container } = render(<RequestStatusBadge status="parsing" />);
    expect(container.firstChild).toHaveClass('bg-parse-bg', 'text-parse-tx');
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders a warning icon for failed', () => {
    const { container } = render(<RequestStatusBadge status="failed" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-red-100', 'text-red-700');
  });

  // Brand rule: no violet/purple/pink/rose anywhere in the client.
  it('never renders a violet, purple, pink, or rose class for any status', () => {
    for (const { status } of cases) {
      const { container, unmount } = render(<RequestStatusBadge status={status} />);
      expect((container.firstChild as HTMLElement).className).not.toMatch(
        /violet|purple|pink|rose/,
      );
      unmount();
    }
  });

  it('uses a non-violet palette for priced', () => {
    const { container } = render(<RequestStatusBadge status="priced" />);
    expect(container.firstChild).toHaveClass('bg-blue-100', 'text-blue-700');
  });

  it('uses the Stratos error tokens for declined', () => {
    const { container } = render(<RequestStatusBadge status="declined" />);
    expect(container.firstChild).toHaveClass('bg-error-bg', 'text-error-tx');
  });
});
