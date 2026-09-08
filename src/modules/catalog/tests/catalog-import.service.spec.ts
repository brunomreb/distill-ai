import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { EmbeddingUnavailableError } from '../errors/catalog.errors';
import { CatalogImportService } from '../catalog-import.service';

const ORG_ID = '20000000-0000-0000-0000-000000000001';

function setup() {
  const repository = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((value) => value),
    save: vi.fn().mockImplementation(async (value) => ({ id: `id-${value.sku_code}`, ...value })),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const dataSource = { query: vi.fn().mockResolvedValue([]) };
  const embeddings = { embed: vi.fn().mockRejectedValue(new EmbeddingUnavailableError('demo')) };
  return {
    service: new CatalogImportService(
      repository as never,
      dataSource as never,
      embeddings as never,
    ),
    repository,
    dataSource,
    embeddings,
  };
}

describe('CatalogImportService', () => {
  it('partially imports CSV, upserts by tenant/code and reports invalid rows', async () => {
    const { service, repository } = setup();
    repository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing' });
    const csv = [
      'sku_code,name,base_price_eur,cost_eur,currency,active',
      'AVAC-001,Unidade interior,1250.50,900,EUR,true',
      'AVAC-002,Unidade exterior,1800,,EUR,true',
      ',Sem código,12,,,true',
    ].join('\n');

    const result = await service.import(ORG_ID, {
      originalname: 'catalogo.csv',
      mimetype: 'text/csv',
      buffer: Buffer.from(csv),
    });

    expect(result).toMatchObject({
      created: 1,
      updated: 1,
      rejected: 1,
      embeddings: { ready: 0, pending: 0, unavailable: 2 },
    });
    expect(result.errors[0]).toMatchObject({ row: 4 });
    expect(repository.findOne).toHaveBeenNthCalledWith(1, {
      where: { org_id: ORG_ID, sku_code: 'AVAC-001' },
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ base_price_minor: 125050, cost_minor: 90000, org_id: ORG_ID }),
    );
  });

  it('reads XLSX and stores successful embeddings as pgvector values', async () => {
    const { service, dataSource, embeddings } = setup();
    embeddings.embed.mockResolvedValue([0.1, 0.2]);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Produtos');
    sheet.addRow(['sku_code', 'name', 'base_price_minor']);
    sheet.addRow(['CAIX-001', 'Perfil PVC', 18500]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await service.import(ORG_ID, {
      originalname: 'catalogo.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    expect(result.embeddings.ready).toBe(1);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('"embedding" = $1::vector'),
      ['[0.1,0.2]', 'id-CAIX-001', ORG_ID],
    );
  });

  it('rejects unsupported files without touching the database', async () => {
    const { service, repository } = setup();
    await expect(
      service.import(ORG_ID, {
        originalname: 'catalogo.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('not a catalog'),
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('defers re-embedding to a durable worker job until the request transaction commits', async () => {
    const { repository, dataSource, embeddings } = setup();
    const queue = { add: vi.fn().mockResolvedValue({ id: 'bull-1' }) };
    const Constructor = CatalogImportService as unknown as new (
      repository: unknown,
      source: unknown,
      client: unknown,
      queue: unknown,
    ) => CatalogImportService;
    const service = new Constructor(repository, dataSource, embeddings, queue);
    const afterCommit: Array<() => Promise<void>> = [];

    const result = await (
      service.import as unknown as (
        orgId: string,
        file: { originalname: string; mimetype: string; buffer: Buffer },
        manager: undefined,
        tasks: Array<() => Promise<void>>,
      ) => Promise<{ embeddings: { pending: number } }>
    )(
      ORG_ID,
      {
        originalname: 'catalogo.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('sku_code,name,base_price_minor\nAVAC-003,Condensadora,200000'),
      },
      undefined,
      afterCommit,
    );

    expect(result.embeddings.pending).toBe(1);
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    await afterCommit[0]();
    expect(queue.add).toHaveBeenCalledWith(
      'catalog:reembed',
      { orgId: ORG_ID, skuId: 'id-AVAC-003' },
      expect.objectContaining({
        jobId: `catalog-reembed-${ORG_ID}-id-AVAC-003`,
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: true,
      }),
    );
  });

  it('serializes imports for one organization inside the RLS transaction', async () => {
    const { service, repository } = setup();
    const manager = {
      query: vi.fn().mockResolvedValue([]),
      getRepository: vi.fn().mockReturnValue(repository),
    };

    await service.import(
      ORG_ID,
      {
        originalname: 'catalogo.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('sku_code,name,base_price_minor\nAVAC-004,Comando,5000'),
      },
      manager as never,
      [],
    );

    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `catalog-import:${ORG_ID}`,
    ]);
  });

  it('propagates database write failures instead of reporting them as invalid input rows', async () => {
    const { service, repository } = setup();
    repository.save.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.import(ORG_ID, {
        originalname: 'catalogo.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('sku_code,name,base_price_minor\nAVAC-005,Termóstato,7500'),
      }),
    ).rejects.toThrow('database unavailable');
  });
});
