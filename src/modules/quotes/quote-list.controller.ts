import { Controller, Get, HttpStatus, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { authConfig } from '@config/auth.config';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { Role } from '@modules/auth/enums/role.enum';
import type { AuthUser } from '@modules/auth/interfaces/auth-user.interface';
import { resolveDemoOrgCandidate } from '@modules/auth/demo-org';
import * as SYS_MSG from '@constants/system-messages';
import type { QuoteSummary } from './interfaces/quote-summary.interface';
import { QuoteModelAction } from './quote.model-action';

@ApiTags('Quotes')
@Controller('quotes')
export class QuoteListController {
  constructor(private readonly quotes: QuoteModelAction) {}

  /** Lists the calling organization's quotes for the navigable quote register. */
  @Get()
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  async list(
    @Req() req: { user?: AuthUser },
  ): Promise<{ statusCode: number; message: string; data: QuoteSummary[] }> {
    let orgId = resolveDemoOrgCandidate(req.user?.orgId);
    if (authConfig.enabled) {
      if (!req.user) {
        throw new CustomHttpException(SYS_MSG.AUTH_UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
      }
      if (!req.user.orgId) {
        throw new CustomHttpException(SYS_MSG.AUTH_FORBIDDEN, HttpStatus.FORBIDDEN);
      }
      orgId = req.user.orgId;
    }

    const quotes = await this.quotes.listForOrg(orgId);
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.QUOTES_RETRIEVED,
      data: quotes.map((quote) => ({
        id: quote.id,
        vertical: quote.request.vertical,
        request_id: quote.request_id,
        quote_number: quote.quote_number,
        status: quote.status,
        total_minor: quote.total_minor,
        currency: quote.currency,
        customer_name: quote.request.sender_company ?? quote.request.sender_contact,
        customer_email: quote.request.sender_email,
        pdf_ready: Boolean(quote.pdf_storage_url),
        created_at: quote.created_at,
      })),
    };
  }
}
