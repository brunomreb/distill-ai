import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { OBJECT_STORE, type ObjectStore } from '@common/object-store/object-store.port';
import type { Request } from '@modules/requests/entities/request.entity';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { QuoteModelAction } from '../quote.model-action';
import { QuoteStatus } from '../enums/quote-status.enum';
import { toQuoteDetail } from '../mappers/quote-detail.mapper';
import { QUOTE_EMAIL_SENDER, type QuoteEmailSender } from './quote-email-sender';

@Injectable()
export class QuoteDeliveryService {
  // Resend guarantees idempotency keys for 24 hours. We stop automatic retries an hour earlier so
  // an uncertain old attempt can never become a duplicate email; an operator must reconcile it.
  private static readonly SAFE_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
  private static readonly REQUEST_SENDABLE_STATUSES = [
    RequestStatus.READY,
    RequestStatus.PRICED,
    RequestStatus.NEEDS_REVIEW,
  ];

  constructor(
    private readonly quotes: QuoteModelAction,
    private readonly requests: RequestModelAction,
    @Inject(OBJECT_STORE) private readonly objectStore: ObjectStore,
    @Inject(QUOTE_EMAIL_SENDER) private readonly sender: QuoteEmailSender,
  ) {}

  async send(request: Request) {
    const found = await this.quotes.getForRequest(request.id);
    if (!found) throw new ConflictException('O pedido ainda não tem um orçamento.');
    const { quote, lines } = found;

    if (quote.status === QuoteStatus.SENT) {
      // A previous attempt may have committed the quote transition immediately before the request
      // status update. Repair that harmless split-brain state without contacting the provider.
      await this.requests.trySetStatus(
        request.id,
        RequestStatus.SENT,
        QuoteDeliveryService.REQUEST_SENDABLE_STATUSES,
      );
      return { quote: toQuoteDetail(quote, lines) };
    }
    if (quote.status !== QuoteStatus.READY || !quote.pdf_storage_url) {
      throw new ConflictException('O PDF tem de ser aprovado e estar pronto antes do envio.');
    }
    if (!request.sender_email) {
      throw new BadRequestException('O pedido não tem um email de destinatário.');
    }

    const attachment = await this.objectStore.get(quote.pdf_storage_url);
    const startedAt = new Date();
    const claimed = await this.quotes.tryStartDelivery(quote.id, request.org_id, startedAt);
    if (!claimed) {
      const current = await this.quotes.getByIdWithLines(quote.id);
      if (current?.quote.status === QuoteStatus.SENT) {
        await this.requests.trySetStatus(
          request.id,
          RequestStatus.SENT,
          QuoteDeliveryService.REQUEST_SENDABLE_STATUSES,
        );
        return { quote: toQuoteDetail(current.quote, current.lines) };
      }
      const previousStart = current?.quote.email_delivery_started_at;
      const safelyRetryable =
        current?.quote.status === QuoteStatus.READY &&
        previousStart instanceof Date &&
        startedAt.getTime() - previousStart.getTime() < QuoteDeliveryService.SAFE_RETRY_WINDOW_MS;
      if (!safelyRetryable) {
        throw new ConflictException(
          'O envio anterior tem estado incerto e requer reconciliação manual.',
        );
      }
    }
    const delivery = await this.sender.send({
      to: request.sender_email,
      subject: quote.email_draft_subject ?? `Orçamento ${quote.quote_number}`,
      text:
        quote.email_draft_body ??
        `Olá,\n\nSegue em anexo o orçamento ${quote.quote_number}.\n\nCom os melhores cumprimentos.`,
      attachment,
      filename: `${quote.quote_number}.pdf`,
      idempotencyKey: `quote/send/${quote.id}`,
    });

    const sentAt = new Date();
    const transitioned = await this.quotes.markSent(
      quote.id,
      request.org_id,
      request.sender_email,
      delivery.messageId,
      sentAt,
    );
    if (!transitioned) {
      const current = await this.quotes.getByIdWithLines(quote.id);
      if (current?.quote.status === QuoteStatus.SENT) {
        await this.requests.trySetStatus(
          request.id,
          RequestStatus.SENT,
          QuoteDeliveryService.REQUEST_SENDABLE_STATUSES,
        );
        return { quote: toQuoteDetail(current.quote, current.lines) };
      }
      throw new ConflictException('O estado do orçamento mudou durante o envio.');
    }

    await this.requests.trySetStatus(request.id, RequestStatus.SENT, [
      ...QuoteDeliveryService.REQUEST_SENDABLE_STATUSES,
    ]);
    quote.status = QuoteStatus.SENT;
    quote.email_sent_at = sentAt;
    quote.email_recipient = request.sender_email;
    quote.email_provider_message_id = delivery.messageId;
    return { quote: toQuoteDetail(quote, lines) };
  }
}
