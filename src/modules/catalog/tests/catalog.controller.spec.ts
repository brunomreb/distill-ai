import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CatalogController } from '../catalog.controller';
import type { CatalogService } from '../catalog.service';
import type { CatalogImportService } from '../catalog-import.service';

const ORG_ID = '20000000-0000-0000-0000-000000000001';
const SKU_ID = '10000000-0000-0000-0000-000000000001';
const user = { orgId: ORG_ID, userId: 'user-1', roles: ['admin'], email: 'admin@example.pt' };
const entityManager = {} as never;
const afterCommit: Array<() => Promise<void>> = [];
const request = { user, entityManager, afterCommit };
const sku = {
  id: SKU_ID,
  org_id: ORG_ID,
  sku_code: 'AVAC-001',
  name: 'Unidade interior',
  base_price_minor: 125000,
};

function setup() {
  const service = {
    searchSkus: vi.fn(),
    listAdmin: vi.fn().mockResolvedValue([sku]),
    createAdmin: vi.fn().mockResolvedValue(sku),
    updateAdmin: vi.fn().mockResolvedValue(sku),
    deactivateAdmin: vi.fn().mockResolvedValue({ ...sku, active: false }),
  } as unknown as CatalogService;
  const importer = {
    import: vi.fn().mockResolvedValue({
      created: 1,
      updated: 0,
      rejected: 0,
      errors: [],
      embeddings: { ready: 0, pending: 0, unavailable: 1 },
    }),
  } as unknown as CatalogImportService;
  const Constructor = CatalogController as unknown as new (
    service: CatalogService,
    importer: CatalogImportService,
  ) => CatalogController;
  return { controller: new Constructor(service, importer), service, importer };
}

describe('CatalogController admin endpoints', () => {
  it('trusts the tenant already validated by demo middleware, including newly onboarded ids', async () => {
    const { controller, service } = setup();
    vi.mocked(service.searchSkus).mockResolvedValue([]);

    await controller.searchSkus('unidade', undefined, request);

    expect(service.searchSkus).toHaveBeenCalledWith('unidade', ORG_ID, undefined, entityManager);
  });

  it('lists the catalog using only the authenticated/demo middleware organization', async () => {
    const { controller, service } = setup();

    const result = await controller.listAdmin(request);

    expect(result).toMatchObject({ statusCode: HttpStatus.OK, data: [sku] });
    expect(service.listAdmin).toHaveBeenCalledWith(ORG_ID, entityManager);
  });

  it('creates a SKU under the caller organization', async () => {
    const { controller, service } = setup();
    const input = {
      sku_code: 'AVAC-001',
      name: 'Unidade interior',
      description: null,
      attributes: {},
      base_price_minor: 125000,
      cost_minor: null,
      currency: 'EUR',
      lead_time_days: null,
    };

    const result = await controller.createAdmin(input, request);

    expect(result.statusCode).toBe(HttpStatus.CREATED);
    expect(service.createAdmin).toHaveBeenCalledWith(ORG_ID, input, entityManager);
  });

  it('updates by id while the service enforces the org scope', async () => {
    const { controller, service } = setup();

    await controller.updateAdmin(SKU_ID, { base_price_minor: 130000 }, request);

    expect(service.updateAdmin).toHaveBeenCalledWith(
      ORG_ID,
      SKU_ID,
      { base_price_minor: 130000 },
      entityManager,
    );
  });

  it('returns 404 instead of revealing a SKU owned by another tenant', async () => {
    const { controller, service } = setup();
    vi.mocked(service.updateAdmin).mockResolvedValue(null);

    await expect(
      controller.updateAdmin(SKU_ID, { base_price_minor: 130000 }, request),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
  });

  it('soft-deactivates through DELETE and returns the updated row', async () => {
    const { controller, service } = setup();

    const result = await controller.deactivateAdmin(SKU_ID, request);

    expect(result.data).toMatchObject({ id: SKU_ID, active: false });
    expect(service.deactivateAdmin).toHaveBeenCalledWith(ORG_ID, SKU_ID, entityManager);
  });

  it('imports CSV/XLSX under the caller organization', async () => {
    const { controller, importer } = setup();
    const file = {
      originalname: 'catalogo.csv',
      mimetype: 'text/csv',
      buffer: Buffer.from('sku_code,name,base_price_minor'),
    };

    const result = await controller.importCatalog(file, request);

    expect(result.data).toMatchObject({ created: 1, rejected: 0 });
    expect(importer.import).toHaveBeenCalledWith(ORG_ID, file, entityManager, afterCommit);
  });
});
