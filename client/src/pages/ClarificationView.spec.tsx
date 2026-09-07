import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PageHeaderProvider, usePageHeader } from '../context/PageHeaderContext';
import { ClarificationView } from './ClarificationView';
import type { Clarification } from '../api/interface/clarification';

const { mockUseClarification, mockUseRequest, mockUseUpdateDraft, mockUseSendClarification } =
  vi.hoisted(() => ({
    mockUseClarification: vi.fn(),
    mockUseRequest: vi.fn(),
    mockUseUpdateDraft: vi.fn(),
    mockUseSendClarification: vi.fn(),
  }));

vi.mock('../api/clarifications', () => ({
  useClarification: (...args: unknown[]) => mockUseClarification(...args),
  useUpdateDraft: (...args: unknown[]) => mockUseUpdateDraft(...args),
  useSendClarification: (...args: unknown[]) => mockUseSendClarification(...args),
}));

vi.mock('../api/requests', () => ({
  useRequest: (...args: unknown[]) => mockUseRequest(...args),
}));

const mockClarification: Clarification = {
  id: 'clar-1',
  request_id: 'req-1',
  gaps: ['Missing delivery date', 'No contact name provided', 'Incomplete billing address'],
  draft_subject: 'Request for additional details',
  draft_body:
    'Dear customer,\n\nWe noticed some missing information in your request.\n\nPlease provide the following:\n- Delivery date\n- Contact name\n- Billing address\n\nThank you.',
  sent_at: null,
  sent_by: null,
  created_at: '2026-06-28T10:00:00.000Z',
  updated_at: '2026-06-28T10:00:00.000Z',
};

const mockRequest = {
  id: 'req-1',
  sender_company: 'Apex Fabrication',
  sender_contact: 'Dana Reyes',
  source_subject: 'RFQ: steel brackets',
};

const mockUpdateDraft = { mutateAsync: vi.fn() };
const mockSend = { mutateAsync: vi.fn() };

function PageHeaderSlots() {
  const { title, actions } = usePageHeader();
  return (
    <>
      <div data-testid="topbar-title">{title}</div>
      <div data-testid="topbar-actions">{actions}</div>
    </>
  );
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/requests/:id/clarification',
        element: <ClarificationView />,
      },
    ],
    { initialEntries: ['/requests/req-1/clarification'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <PageHeaderProvider>
        <PageHeaderSlots />
        <RouterProvider router={router} />
      </PageHeaderProvider>
    </QueryClientProvider>,
  );
}

describe('ClarificationView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseClarification.mockReturnValue({
      data: mockClarification,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseRequest.mockReturnValue({ data: mockRequest });
    mockUseUpdateDraft.mockReturnValue(mockUpdateDraft);
    mockUseSendClarification.mockReturnValue(mockSend);
  });

  it('renders the loading state while clarification loads', () => {
    mockUseClarification.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByText(/a carregar esclarecimento/i)).toBeInTheDocument();
  });

  it('renders the error state with retry when clarification fails to load', () => {
    const refetch = vi.fn();
    mockUseClarification.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    renderPage();
    expect(screen.getByText(/não foi possível carregar o esclarecimento/i)).toBeInTheDocument();
    screen.getByRole('button', { name: /tentar novamente/i }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it('renders the gaps checklist from the stored clarification (AC-02)', () => {
    renderPage();
    expect(screen.getByText(/informação em falta/i)).toBeInTheDocument();
    expect(screen.getByText('Missing delivery date')).toBeInTheDocument();
    expect(screen.getByText('No contact name provided')).toBeInTheDocument();
    expect(screen.getByText('Incomplete billing address')).toBeInTheDocument();
  });

  it('renders the editable draft subject and body from the stored clarification (AC-02)', () => {
    renderPage();
    const subjectInput = screen.getByLabelText('Assunto') as HTMLInputElement;
    const bodyTextarea = screen.getByLabelText('Mensagem') as HTMLTextAreaElement;
    expect(subjectInput.value).toBe('Request for additional details');
    expect(bodyTextarea.value).toContain('Dear customer');
  });

  it('shows the heading with the sender company name', () => {
    renderPage();
    expect(screen.getByText(/esclarecimento · apex fabrication/i)).toBeInTheDocument();
  });

  it('disables the Send button when subject is empty (EC-02)', () => {
    mockUseClarification.mockReturnValue({
      data: { ...mockClarification, draft_subject: '', draft_body: '' },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole('button', { name: /enviar esclarecimento/i })).toBeDisabled();
  });

  it('disables the Send button when body is empty (EC-02)', () => {
    mockUseClarification.mockReturnValue({
      data: { ...mockClarification, draft_subject: 'Subject', draft_body: '' },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole('button', { name: /enviar esclarecimento/i })).toBeDisabled();
  });

  it('enables the Send button when both subject and body are filled', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /enviar esclarecimento/i })).toBeEnabled();
  });

  it('calls updateDraft then send when Send is clicked and draft is dirty (AC-01)', async () => {
    const user = userEvent.setup();
    const updateAsync = vi.fn().mockResolvedValue(mockClarification);
    const sendAsync = vi
      .fn()
      .mockResolvedValue({ id: 'clar-1', sent_at: new Date().toISOString(), sent_by: 'user-1' });
    mockUseUpdateDraft.mockReturnValue({ mutateAsync: updateAsync });
    mockUseSendClarification.mockReturnValue({ mutateAsync: sendAsync });

    renderPage();

    const subjectInput = screen.getByLabelText('Assunto');
    await user.type(subjectInput, ' edited');

    await user.click(screen.getByRole('button', { name: /enviar esclarecimento/i }));

    expect(updateAsync).toHaveBeenCalledWith({
      clarificationId: 'clar-1',
      payload: {
        draft_subject: 'Request for additional details edited',
        draft_body: mockClarification.draft_body?.trim(),
      },
    });
    expect(sendAsync).toHaveBeenCalledWith({
      clarificationId: 'clar-1',
      requestId: 'req-1',
    });
  });

  it('calls only send when draft is not dirty (no edits)', async () => {
    const user = userEvent.setup();
    const updateAsync = vi.fn();
    const sendAsync = vi
      .fn()
      .mockResolvedValue({ id: 'clar-1', sent_at: new Date().toISOString(), sent_by: 'user-1' });
    mockUseUpdateDraft.mockReturnValue({ mutateAsync: updateAsync });
    mockUseSendClarification.mockReturnValue({ mutateAsync: sendAsync });

    renderPage();

    await user.click(screen.getByRole('button', { name: /enviar esclarecimento/i }));

    expect(updateAsync).not.toHaveBeenCalled();
    expect(sendAsync).toHaveBeenCalled();
  });

  it('shows an error and keeps the draft editable when send fails (EC-03)', async () => {
    const user = userEvent.setup();
    const sendAsync = vi.fn().mockRejectedValue({
      response: { data: { message: 'Server error sending clarification' } },
    });
    mockUseSendClarification.mockReturnValue({ mutateAsync: sendAsync });

    renderPage();

    await user.click(screen.getByRole('button', { name: /enviar esclarecimento/i }));

    expect(await screen.findByText('Server error sending clarification')).toBeInTheDocument();
    expect(screen.getByLabelText('Assunto')).not.toBeDisabled();
    expect(screen.getByLabelText('Mensagem')).not.toBeDisabled();
  });

  it('shows a generic error when send fails without a server message (EC-03)', async () => {
    const user = userEvent.setup();
    const sendAsync = vi.fn().mockRejectedValue(new Error('network error'));
    mockUseSendClarification.mockReturnValue({ mutateAsync: sendAsync });

    renderPage();

    await user.click(screen.getByRole('button', { name: /enviar esclarecimento/i }));

    expect(
      await screen.findByText('Não foi possível enviar o esclarecimento.'),
    ).toBeInTheDocument();
  });

  it('shows the unsaved changes blocker dialog when clicking Cancel with dirty edits (EC-01)', async () => {
    const user = userEvent.setup();
    renderPage();

    const subjectInput = screen.getByLabelText('Assunto');
    await user.type(subjectInput, ' changed');

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.getByRole('dialog', { name: /alterações por guardar/i })).toBeInTheDocument();
  });

  it('shows the unsaved changes blocker dialog when clicking back button with dirty edits (EC-01)', async () => {
    const user = userEvent.setup();
    renderPage();

    const subjectInput = screen.getByLabelText('Assunto');
    await user.type(subjectInput, ' changed');

    await user.click(screen.getByRole('button', { name: /voltar à caixa de entrada/i }));

    expect(screen.getByRole('dialog', { name: /alterações por guardar/i })).toBeInTheDocument();
  });

  it('does not show the blocker dialog when navigating without dirty edits', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /voltar à caixa de entrada/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates away after confirming discard in the blocker dialog', async () => {
    const user = userEvent.setup();
    renderPage();

    const subjectInput = screen.getByLabelText('Assunto');
    await user.type(subjectInput, ' changed');

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    await user.click(screen.getByRole('button', { name: /descartar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the destructive Discard action with the Stratos error tokens, not rose', async () => {
    const user = userEvent.setup();
    renderPage();

    const subjectInput = screen.getByLabelText('Assunto');
    await user.type(subjectInput, ' changed');
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    const discardButton = screen.getByRole('button', { name: /descartar/i });
    expect(discardButton.className).not.toMatch(/rose/);
    expect(discardButton.className).toContain('bg-error-solid');
  });

  it('stays on the page after clicking Stay in the blocker dialog', async () => {
    const user = userEvent.setup();
    renderPage();

    const subjectInput = screen.getByLabelText('Assunto');
    await user.type(subjectInput, ' changed');

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    await user.click(screen.getByRole('button', { name: /ficar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Assunto')).toHaveValue('Request for additional details changed');
  });

  it('shows a sent banner when the clarification has already been sent', () => {
    mockUseClarification.mockReturnValue({
      data: { ...mockClarification, sent_at: '2026-06-29T10:00:00.000Z' },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText(/este esclarecimento já foi enviado/i)).toBeInTheDocument();
  });

  it('disables the Send button when the clarification is already sent', () => {
    mockUseClarification.mockReturnValue({
      data: { ...mockClarification, sent_at: '2026-06-29T10:00:00.000Z' },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole('button', { name: /enviar esclarecimento/i })).toBeDisabled();
  });

  it('disables the subject and body inputs when the clarification is already sent', () => {
    mockUseClarification.mockReturnValue({
      data: { ...mockClarification, sent_at: '2026-06-29T10:00:00.000Z' },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByLabelText('Assunto')).toBeDisabled();
    expect(screen.getByLabelText('Mensagem')).toBeDisabled();
  });

  it('shows unsaved status in the header actions when edits are made', async () => {
    const user = userEvent.setup();
    renderPage();

    const subjectInput = screen.getByLabelText('Assunto');
    await user.type(subjectInput, ' x');

    expect(screen.getByText(/editado · por guardar/i)).toBeInTheDocument();
  });
});
