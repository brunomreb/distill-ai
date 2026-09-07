import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- pdfkit's types use `export =`; a default import type-checks but calls a nonexistent `.default` at runtime.
import PDFDocument = require('pdfkit');

export interface QuotePdfLineInput {
  sku: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  kind?: 'equipment' | 'material' | 'labor' | 'consumable' | 'margin' | 'tax';
}

export interface QuotePdfBranding {
  companyName: string;
  primaryColor: string;
  vatNumber: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  footerText: string | null;
  logo?: Buffer;
}

export interface QuotePdfInput {
  quoteNumber: string;
  issuedDate: Date;
  senderCompany: string | null;
  senderContact: string | null;
  senderEmail: string | null;
  senderAddress: string | null;
  lines: QuotePdfLineInput[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  leadTimeDays: number | null;
  terms: string | null;
  validUntil: string | null;
  branding?: QuotePdfBranding;
}

/** Mirrors client/src/tokens.json - pdfkit has no access to the CSS token pipeline. */
const COLOR = {
  brand: '#5EEAD4',
  page: '#020203',
  surface: '#0C0D10',
  ink: '#F7F9FA',
  body: '#A7B0BC',
  muted: '#788391',
  border: '#23262D',
};

const PAGE_MARGIN = 50;
const TOTALS_BLOCK_HEIGHT = 80;

/** Formats a minor-unit amount for display. Money is stored and compared in minor units everywhere
 * else in this codebase; this is the one place it is converted to a decimal string. */
function formatMinor(minor: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(minor / 100);
}

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Parses date-only strings as UTC midnight so the rendered date can't shift by a day depending on
 * the host timezone the service happens to run in. */
function formatDate(value: Date | string): string {
  const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return DATE_FORMATTER.format(date);
}

interface Columns {
  contentWidth: number;
  rightEdge: number;
  desc: { x: number; width: number };
  qty: { x: number; width: number };
  price: { x: number; width: number };
  amount: { x: number; width: number };
}

function buildColumns(doc: PDFKit.PDFDocument): Columns {
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  const descWidth = contentWidth * 0.52;
  const qtyWidth = contentWidth * 0.12;
  const priceWidth = contentWidth * 0.18;
  const amountWidth = contentWidth - descWidth - qtyWidth - priceWidth;
  const descX = PAGE_MARGIN;
  const qtyX = descX + descWidth;
  const priceX = qtyX + qtyWidth;
  const amountX = priceX + priceWidth;
  return {
    contentWidth,
    rightEdge: PAGE_MARGIN + contentWidth,
    desc: { x: descX, width: descWidth },
    qty: { x: qtyX, width: qtyWidth },
    price: { x: priceX, width: priceWidth },
    amount: { x: amountX, width: amountWidth },
  };
}

/** Bottom edge of the printable area; content at or past this y must roll onto a new page. */
function pageBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - PAGE_MARGIN;
}

/** Templates a priced quote into a PDF matching the Figma "Quote Output" layout. */
@Injectable()
export class QuotePdfRenderer {
  async render(input: QuotePdfInput): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const columns = buildColumns(doc);
    this.paintPage(doc);
    let y = this.renderHeader(doc, columns, input);
    y = this.renderBillTo(doc, columns, input, y);
    y = this.renderLineItems(
      doc,
      columns,
      input.lines.filter((line) => line.kind !== 'tax'),
      input.currency,
      y,
    );
    y = this.ensureRoom(doc, columns, y, TOTALS_BLOCK_HEIGHT);
    y = this.renderTotals(doc, columns, input, y);
    this.renderFooter(doc, columns, input, y);

    doc.end();
    return done;
  }

  private paintPage(doc: PDFKit.PDFDocument): void {
    doc.save().rect(0, 0, doc.page.width, doc.page.height).fill(COLOR.page).restore();
  }

  private addPage(doc: PDFKit.PDFDocument): void {
    doc.addPage();
    this.paintPage(doc);
  }

  /** Starts a new page and repositions to the top margin when `needed` vertical space won't fit. */
  private ensureRoom(doc: PDFKit.PDFDocument, columns: Columns, y: number, needed: number): number {
    if (y + needed <= pageBottom(doc)) {
      return y;
    }
    this.addPage(doc);
    return PAGE_MARGIN;
  }

  private renderHeader(doc: PDFKit.PDFDocument, columns: Columns, input: QuotePdfInput): number {
    const top = PAGE_MARGIN;
    const brandColor = input.branding?.primaryColor ?? COLOR.brand;
    if (input.branding?.logo) {
      doc.image(input.branding.logo, columns.desc.x, top, { fit: [120, 28] });
    } else {
      doc
        .fillColor(brandColor)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(input.branding?.companyName ?? 'Motor de Orçamentos', columns.desc.x, top + 1);
    }

    doc
      .fillColor(COLOR.ink)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(`ORÇAMENTO ${input.quoteNumber}`, columns.desc.x, top, {
        width: columns.contentWidth,
        align: 'right',
      });
    doc
      .fillColor(COLOR.muted)
      .fontSize(9)
      .font('Helvetica')
      .text(`Data: ${formatDate(input.issuedDate)}`, columns.desc.x, top + 20, {
        width: columns.contentWidth,
        align: 'right',
      });

    const ruleY = top + 40;
    doc
      .moveTo(columns.desc.x, ruleY)
      .lineTo(columns.rightEdge, ruleY)
      .strokeColor(COLOR.border)
      .stroke();
    return ruleY + 20;
  }

  private renderBillTo(
    doc: PDFKit.PDFDocument,
    columns: Columns,
    input: QuotePdfInput,
    startY: number,
  ): number {
    let y = startY;
    doc
      .fillColor(COLOR.muted)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('CLIENTE', columns.desc.x, y);
    y += 14;
    if (input.senderCompany) {
      doc.fillColor(COLOR.ink).fontSize(11).text(input.senderCompany, columns.desc.x, y);
      y += 15;
    }
    if (input.senderContact) {
      doc.fillColor(COLOR.body).fontSize(10).text(input.senderContact, columns.desc.x, y);
      y += 14;
    }
    if (input.senderEmail) {
      doc.fillColor(COLOR.body).fontSize(10).text(input.senderEmail, columns.desc.x, y);
      y += 14;
    }
    if (input.senderAddress) {
      doc.fillColor(COLOR.body).fontSize(10);
      const addressHeight = doc.heightOfString(input.senderAddress, { width: columns.desc.width });
      doc.text(input.senderAddress, columns.desc.x, y, {
        width: columns.desc.width,
      });
      y += addressHeight + 2;
    }
    return y + 30;
  }

  private renderColumnHeaders(doc: PDFKit.PDFDocument, columns: Columns, startY: number): number {
    let y = startY;
    doc.fillColor(COLOR.muted).fontSize(8);
    doc.font('Helvetica-Bold');
    doc.text('DESCRIÇÃO', columns.desc.x, y, { width: columns.desc.width });
    doc.text('QTD.', columns.qty.x, y, { width: columns.qty.width, align: 'right' });
    doc.text('PREÇO UNIT.', columns.price.x, y, { width: columns.price.width, align: 'right' });
    doc.text('TOTAL', columns.amount.x, y, { width: columns.amount.width, align: 'right' });
    y += 16;
    doc.moveTo(columns.desc.x, y).lineTo(columns.rightEdge, y).strokeColor(COLOR.border).stroke();
    return y + 10;
  }

  private renderLineItems(
    doc: PDFKit.PDFDocument,
    columns: Columns,
    lines: QuotePdfLineInput[],
    currency: string,
    startY: number,
  ): number {
    let y = this.renderColumnHeaders(doc, columns, startY);

    for (const line of lines) {
      doc.fontSize(10);
      const descHeight = doc.heightOfString(line.description, { width: columns.desc.width });
      const skuHeight = line.sku ? 13 : 0;
      const rowHeight = descHeight + skuHeight + 22;
      if (y + rowHeight > pageBottom(doc)) {
        this.addPage(doc);
        y = this.renderColumnHeaders(doc, columns, PAGE_MARGIN);
      }

      doc.fillColor(COLOR.ink).fontSize(10).text(line.description, columns.desc.x, y, {
        width: columns.desc.width,
      });
      doc.fillColor(COLOR.ink).fontSize(10).text(String(line.quantity), columns.qty.x, y, {
        width: columns.qty.width,
        align: 'right',
      });
      doc
        .fillColor(COLOR.ink)
        .fontSize(10)
        .text(formatMinor(line.unitPriceMinor, currency), columns.price.x, y, {
          width: columns.price.width,
          align: 'right',
        });
      doc
        .fillColor(COLOR.ink)
        .fontSize(10)
        .text(formatMinor(line.amountMinor, currency), columns.amount.x, y, {
          width: columns.amount.width,
          align: 'right',
        });
      y += descHeight;
      if (line.sku) {
        doc.fillColor(COLOR.muted).fontSize(8).text(`Ref.: ${line.sku}`, columns.desc.x, y, {
          width: columns.desc.width,
        });
        y += 13;
      }
      y += 8;
      doc.moveTo(columns.desc.x, y).lineTo(columns.rightEdge, y).strokeColor(COLOR.border).stroke();
      y += 14;
    }

    return y;
  }

  private renderTotals(
    doc: PDFKit.PDFDocument,
    columns: Columns,
    input: QuotePdfInput,
    startY: number,
  ): number {
    let y = startY;
    const labelWidth = columns.price.width;
    const labelX = columns.price.x;
    const valueX = columns.amount.x;
    const valueWidth = columns.amount.width;

    doc.fillColor(COLOR.body).fontSize(10);
    doc.text('Subtotal (sem IVA)', labelX, y, { width: labelWidth, align: 'left' });
    doc.text(formatMinor(input.subtotalMinor, input.currency), valueX, y, {
      width: valueWidth,
      align: 'right',
    });
    y += 18;

    if (input.discountMinor > 0) {
      doc.fillColor(COLOR.body).fontSize(10);
      doc.text('Desconto', labelX, y, { width: labelWidth, align: 'left' });
      doc.text(`-${formatMinor(input.discountMinor, input.currency)}`, valueX, y, {
        width: valueWidth,
        align: 'right',
      });
      y += 18;
    }

    const taxLine = input.lines.find((line) => line.kind === 'tax');
    if (taxLine) {
      doc.fillColor(COLOR.body).fontSize(10);
      doc.text(taxLine.description, labelX, y, { width: labelWidth, align: 'left' });
      doc.text(formatMinor(taxLine.amountMinor, input.currency), valueX, y, {
        width: valueWidth,
        align: 'right',
      });
      y += 18;
    }

    doc.fillColor(COLOR.ink).fontSize(12);
    doc.text(`Total (${input.currency})`, labelX, y, { width: labelWidth, align: 'left' });
    doc
      .fillColor(input.branding?.primaryColor ?? COLOR.brand)
      .text(formatMinor(input.totalMinor, input.currency), valueX, y, {
        width: valueWidth,
        align: 'right',
      });
    return y + 30;
  }

  private renderFooter(
    doc: PDFKit.PDFDocument,
    columns: Columns,
    input: QuotePdfInput,
    startY: number,
  ): void {
    const parts: string[] = [];
    if (input.leadTimeDays !== null) {
      parts.push(`Prazo estimado: ${input.leadTimeDays} dias`);
    }
    if (input.terms) {
      parts.push(`Condições: ${input.terms}`);
    }
    if (input.validUntil) {
      parts.push(`Válido até ${formatDate(input.validUntil)}`);
    }
    if (input.branding?.vatNumber) parts.push(`NIF: ${input.branding.vatNumber}`);
    if (input.branding?.address) parts.push(input.branding.address);
    if (input.branding?.email) parts.push(input.branding.email);
    if (input.branding?.phone) parts.push(input.branding.phone);
    if (input.branding?.footerText) parts.push(input.branding.footerText);
    if (parts.length === 0) {
      return;
    }

    const text = parts.join('. ');
    doc.fontSize(9);
    const textHeight = doc.heightOfString(text, { width: columns.contentWidth });
    const y = this.ensureRoom(doc, columns, startY, 12 + textHeight);

    doc.moveTo(columns.desc.x, y).lineTo(columns.rightEdge, y).strokeColor(COLOR.border).stroke();
    doc
      .fillColor(COLOR.muted)
      .fontSize(9)
      .text(text, columns.desc.x, y + 12, {
        width: columns.contentWidth,
      });
  }
}
