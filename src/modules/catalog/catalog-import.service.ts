import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EmbeddingsClientService } from './embeddings-client.service';
import { Sku } from './entities/sku.entity';
import type { Queue } from 'bull';
import { CATALOG_JOBS, QUEUES, catalogEmbeddingJobId } from '@common/constants/queue.constants';
import type { AfterCommitTask } from '@common/http/after-commit';
import { isEuroCurrency, STRATOS_CURRENCY } from '@common/constants/currency.constants';

export interface CatalogUpload {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface CatalogImportResult {
  created: number;
  updated: number;
  rejected: number;
  errors: Array<{ row: number; message: string }>;
  embeddings: { ready: number; pending: number; unavailable: number };
}

type RawRow = Record<string, string | number | boolean | null>;

interface ParsedSku {
  sku_code: string;
  name: string;
  description: string | null;
  attributes: Record<string, unknown>;
  base_price_minor: number;
  cost_minor: number | null;
  currency: string;
  lead_time_days: number | null;
  active: boolean;
}

const HEADER_ALIASES: Record<string, string> = {
  codigo: 'sku_code',
  código: 'sku_code',
  nome: 'name',
  descricao: 'description',
  descrição: 'description',
  atributos: 'attributes',
  preco_eur: 'base_price_eur',
  preço_eur: 'base_price_eur',
  custo_eur: 'cost_eur',
  moeda: 'currency',
  prazo_dias: 'lead_time_days',
  ativo: 'active',
};

@Injectable()
export class CatalogImportService {
  constructor(
    @InjectRepository(Sku) private readonly skus: Repository<Sku>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly embeddings: EmbeddingsClientService,
    @Optional()
    @InjectQueue(QUEUES.CATALOG)
    private readonly catalogQueue?: Queue,
  ) {}

  async import(
    orgId: string,
    file: CatalogUpload,
    entityManager?: EntityManager,
    afterCommit?: AfterCommitTask[],
  ): Promise<CatalogImportResult> {
    const skus = entityManager?.getRepository(Sku) ?? this.skus;
    const rows = await this.readRows(file);
    // The unique key is (org_id, sku_code). Serializing one tenant's imports closes the
    // check-then-insert race while still allowing different tenants to import concurrently.
    if (entityManager) {
      await entityManager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `catalog-import:${orgId}`,
      ]);
    }
    const result: CatalogImportResult = {
      created: 0,
      updated: 0,
      rejected: 0,
      errors: [],
      embeddings: { ready: 0, pending: 0, unavailable: 0 },
    };

    const validRows: Array<{ rowNumber: number; parsed: ParsedSku }> = [];
    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      try {
        validRows.push({ rowNumber, parsed: this.parseRow(rows[index]) });
      } catch (error) {
        result.rejected += 1;
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Linha inválida',
        });
      }
    }

    for (const { parsed } of validRows) {
      const existing = await skus.findOne({
        where: { org_id: orgId, sku_code: parsed.sku_code },
      });
      const entity = existing
        ? Object.assign(existing, parsed, { embedding_status: 'pending', embedding_error: null })
        : skus.create({
            ...parsed,
            org_id: orgId,
            embedding_status: 'pending',
            embedding_error: null,
          });
      const saved = await skus.save(entity);
      if (existing) result.updated += 1;
      else result.created += 1;

      if (this.catalogQueue && afterCommit) {
        result.embeddings.pending += 1;
        afterCommit.push(() => this.enqueueEmbedding(orgId, saved.id));
      } else {
        await this.refreshEmbedding(saved, orgId, result, skus, entityManager);
      }
    }

    return result;
  }

  private async enqueueEmbedding(orgId: string, skuId: string): Promise<void> {
    await this.catalogQueue?.add(
      CATALOG_JOBS.REEMBED,
      { orgId, skuId },
      {
        jobId: catalogEmbeddingJobId(orgId, skuId),
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  private async readRows(file: CatalogUpload): Promise<RawRow[]> {
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (!['csv', 'xlsx'].includes(extension ?? '')) {
      throw new BadRequestException('Formato inválido. Utilize um ficheiro CSV ou XLSX.');
    }

    const workbook = new ExcelJS.Workbook();
    let worksheet: ExcelJS.Worksheet | undefined;
    try {
      if (extension === 'xlsx') {
        await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
        worksheet = workbook.worksheets[0];
      } else {
        const firstLine = file.buffer.toString('utf8').split(/\r?\n/, 1)[0] ?? '';
        const delimiter = firstLine.includes(';') ? ';' : ',';
        worksheet = await workbook.csv.read(Readable.from([file.buffer]), {
          parserOptions: { delimiter },
        });
      }
    } catch {
      throw new BadRequestException('Não foi possível ler o ficheiro de catálogo.');
    }
    if (!worksheet || worksheet.rowCount < 2) {
      throw new BadRequestException(
        'O catálogo tem de incluir cabeçalhos e pelo menos um produto.',
      );
    }

    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    for (let column = 1; column <= headerRow.actualCellCount; column += 1) {
      headers.push(this.normalizeHeader(headerRow.getCell(column).text));
    }
    if (!headers.includes('sku_code') || !headers.includes('name')) {
      throw new BadRequestException('Cabeçalhos obrigatórios em falta: sku_code e name.');
    }
    if (!headers.includes('base_price_minor') && !headers.includes('base_price_eur')) {
      throw new BadRequestException('Inclua base_price_minor ou base_price_eur.');
    }

    const rows: RawRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: RawRow = {};
      let hasValue = false;
      for (let column = 1; column <= headers.length; column += 1) {
        const header = headers[column - 1];
        if (!header) continue;
        const value = this.cellValue(row.getCell(column));
        if (value !== null && String(value).trim() !== '') hasValue = true;
        record[header] = value;
      }
      if (hasValue) rows.push(record);
    });
    return rows;
  }

  private normalizeHeader(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    return HEADER_ALIASES[normalized] ?? normalized;
  }

  private cellValue(cell: ExcelJS.Cell): string | number | boolean | null {
    if (cell.value === null || cell.value === undefined) return null;
    if (typeof cell.value === 'number' || typeof cell.value === 'boolean') return cell.value;
    return cell.text.trim();
  }

  private parseRow(row: RawRow): ParsedSku {
    const skuCode = this.requiredText(row.sku_code, 'sku_code').toUpperCase();
    const name = this.requiredText(row.name, 'name');
    const basePrice = row.base_price_minor ?? row.base_price_eur;
    const basePriceMinor =
      row.base_price_minor !== undefined
        ? this.nonNegativeInteger(basePrice, 'base_price_minor')
        : this.eurosToMinor(basePrice, 'base_price_eur');
    const costMinor =
      row.cost_minor !== undefined && row.cost_minor !== null && row.cost_minor !== ''
        ? this.nonNegativeInteger(row.cost_minor, 'cost_minor')
        : row.cost_eur !== undefined && row.cost_eur !== null && row.cost_eur !== ''
          ? this.eurosToMinor(row.cost_eur, 'cost_eur')
          : null;

    let attributes: Record<string, unknown> = {};
    if (row.attributes !== undefined && row.attributes !== null && row.attributes !== '') {
      try {
        const parsed = JSON.parse(String(row.attributes)) as unknown;
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
        attributes = parsed as Record<string, unknown>;
      } catch {
        throw new Error('attributes tem de ser um objeto JSON válido');
      }
    }

    const currency = (this.optionalText(row.currency) ?? STRATOS_CURRENCY).toUpperCase();
    if (!isEuroCurrency(currency)) {
      throw new Error('A moeda tem de ser EUR');
    }

    return {
      sku_code: skuCode,
      name,
      description: this.optionalText(row.description),
      attributes,
      base_price_minor: basePriceMinor,
      cost_minor: costMinor,
      currency: STRATOS_CURRENCY,
      lead_time_days:
        row.lead_time_days === undefined || row.lead_time_days === null || row.lead_time_days === ''
          ? null
          : this.nonNegativeInteger(row.lead_time_days, 'lead_time_days'),
      active: this.booleanValue(row.active),
    };
  }

  private requiredText(value: unknown, field: string): string {
    const parsed = this.optionalText(value);
    if (!parsed) throw new Error(`${field} é obrigatório`);
    return parsed;
  }

  private optionalText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const parsed = String(value).trim();
    return parsed || null;
  }

  private nonNegativeInteger(value: unknown, field: string): number {
    const text = String(value ?? '').trim();
    if (!/^\d+$/.test(text)) throw new Error(`${field} tem de ser um inteiro não negativo`);
    const parsed = Number(text);
    if (!Number.isSafeInteger(parsed)) throw new Error(`${field} excede o limite permitido`);
    return parsed;
  }

  /** Exact decimal-to-cents conversion; never relies on binary floating-point multiplication. */
  private eurosToMinor(value: unknown, field: string): number {
    const text = String(value ?? '')
      .trim()
      .replace(',', '.');
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
    if (!match) throw new Error(`${field} tem de ter no máximo duas casas decimais`);
    const euros = Number(match[1]);
    const cents = Number((match[2] ?? '').padEnd(2, '0'));
    const minor = euros * 100 + cents;
    if (!Number.isSafeInteger(minor)) throw new Error(`${field} excede o limite permitido`);
    return minor;
  }

  private booleanValue(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return true;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'sim', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'não', 'nao', 'no'].includes(normalized)) return false;
    throw new Error('active tem de ser true/false ou sim/não');
  }

  private async refreshEmbedding(
    sku: Sku,
    orgId: string,
    result: CatalogImportResult,
    skus: Repository<Sku>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const vector = await this.embeddings.embed(
        [sku.sku_code, sku.name, sku.description].filter(Boolean).join(' '),
      );
      await (entityManager ?? this.dataSource).query(
        `UPDATE "skus" SET "embedding" = $1::vector, "embedding_status" = 'ready', "embedding_error" = NULL, "updated_at" = now() WHERE "id" = $2 AND "org_id" = $3`,
        [`[${vector.join(',')}]`, sku.id, orgId],
      );
      result.embeddings.ready += 1;
    } catch (error) {
      const message = (error instanceof Error ? error.message : 'indisponível').slice(0, 500);
      await skus.update(
        { id: sku.id, org_id: orgId },
        { embedding_status: 'unavailable', embedding_error: message },
      );
      result.embeddings.unavailable += 1;
    }
  }
}
