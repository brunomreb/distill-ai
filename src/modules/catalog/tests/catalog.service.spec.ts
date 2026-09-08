import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from '../catalog.service';
import type { Sku } from '../entities/sku.entity';

function makeService(rows: unknown[] = []) {
  const query = vi.fn().mockResolvedValue(rows);
  const service = new CatalogService({ query } as never);
  return { service, query };
}

describe('CatalogService.searchSkus', () => {
  it('returns an empty list for a blank query without hitting the database', async () => {
    const { service, query } = makeService();
    expect(await service.searchSkus('   ', 'org-1')).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('scopes the query to the org when an org id is provided (SEC-02)', async () => {
    const { service, query } = makeService([{ sku_id: 'sku-1' }]);
    await service.searchSkus('socket', 'org-1', 5);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/org_id = \$2/);
    expect(sql).toMatch(/active = true/);
    expect(params).toEqual(['socket', 'org-1', 5]);
  });

  it('omits the org filter when no caller org is known (single-tenant dev)', async () => {
    const { service, query } = makeService([]);
    await service.searchSkus('bolt', undefined);

    const [sql, params] = query.mock.calls[0];
    expect(sql).not.toMatch(/org_id =/);
    expect(params).toEqual(['bolt', 10]); // default limit, no org param
  });

  it('caps the limit at 25', async () => {
    const { service, query } = makeService([]);
    await service.searchSkus('nut', 'org-1', 999);
    expect(query.mock.calls[0][1]).toEqual(['nut', 'org-1', 25]);
  });
});

describe('CatalogService admin CRUD', () => {
  const sku = {
    id: '10000000-0000-0000-0000-000000000001',
    org_id: '20000000-0000-0000-0000-000000000001',
    sku_code: 'AVAC-001',
    name: 'Unidade interior',
    description: null,
    attributes: {},
    base_price_minor: 125000,
    cost_minor: 90000,
    currency: 'EUR',
    lead_time_days: 7,
    active: true,
    embedding: null,
    embedding_status: 'unavailable',
    embedding_error: null,
  } as unknown as Sku;

  function makeAdminService() {
    const manager = {
      find: vi.fn().mockResolvedValue([sku]),
      save: vi.fn().mockResolvedValue(sku),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      findOne: vi.fn().mockResolvedValue(sku),
    };
    const service = new CatalogService({ manager } as never);
    return { service, manager };
  }

  it('lists only the selected organization catalog, including inactive rows for administration', async () => {
    const { service, manager } = makeAdminService();

    const result = await service.listAdmin(sku.org_id);

    expect(result).toEqual([sku]);
    expect(manager.find).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ where: { org_id: sku.org_id }, order: { sku_code: 'ASC' } }),
    );
  });

  it('creates a SKU with the caller organization and normalized currency', async () => {
    const { service, manager } = makeAdminService();

    await service.createAdmin(sku.org_id, {
      sku_code: ' avac-001 ',
      name: ' Unidade interior ',
      description: null,
      attributes: {},
      base_price_minor: 125000,
      cost_minor: 90000,
      currency: 'eur',
      lead_time_days: 7,
    });

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        org_id: sku.org_id,
        sku_code: 'AVAC-001',
        name: 'Unidade interior',
        currency: 'EUR',
        active: true,
        embedding_status: 'pending',
      }),
    );
  });

  it('rejects a non-EUR SKU before writing to the catalog', async () => {
    const { service, manager } = makeAdminService();

    await expect(
      service.createAdmin(sku.org_id, {
        sku_code: 'AVAC-NGN',
        name: 'Produto inválido',
        description: null,
        attributes: {},
        base_price_minor: 125000,
        cost_minor: null,
        currency: 'NGN',
        lead_time_days: null,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('normalizes an empty UI attributes field to an empty JSON object', async () => {
    const { service, manager } = makeAdminService();

    await service.createAdmin(sku.org_id, {
      sku_code: 'AVAC-EMPTY',
      name: 'Sem atributos',
      description: null,
      attributes: null,
      base_price_minor: 100,
      cost_minor: null,
      currency: 'EUR',
      lead_time_days: null,
    });

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ attributes: {} }),
    );
  });

  it('updates by both id and org id so another tenant cannot mutate the SKU', async () => {
    const { service, manager } = makeAdminService();

    await service.updateAdmin(sku.org_id, sku.id, { base_price_minor: 130000 });

    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: sku.id, org_id: sku.org_id },
      { base_price_minor: 130000 },
    );
    expect(manager.findOne).toHaveBeenCalledWith(expect.anything(), {
      where: { id: sku.id, org_id: sku.org_id },
    });
  });

  it('rejects a non-EUR currency patch before updating the catalog', async () => {
    const { service, manager } = makeAdminService();

    await expect(
      service.updateAdmin(sku.org_id, sku.id, { currency: 'GBP' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('returns null when an update targets a SKU outside the caller organization', async () => {
    const { service, manager } = makeAdminService();
    manager.update.mockResolvedValue({ affected: 0 });

    await expect(
      service.updateAdmin(sku.org_id, '30000000-0000-0000-0000-000000000001', {
        base_price_minor: 1,
      }),
    ).resolves.toBeNull();
    expect(manager.findOne).not.toHaveBeenCalled();
  });

  it('deactivates instead of deleting, preserving historical quote references', async () => {
    const { service, manager } = makeAdminService();

    await service.deactivateAdmin(sku.org_id, sku.id);

    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: sku.id, org_id: sku.org_id },
      { active: false },
    );
  });

  it('generates an embedding after an admin creates a product', async () => {
    const { manager } = makeAdminService();
    const dataSource = { manager, query: vi.fn().mockResolvedValue([]) };
    const embeddings = { embed: vi.fn().mockResolvedValue([0.25, 0.5]) };
    type FakeDataSource = typeof dataSource;
    type FakeEmbeddings = typeof embeddings;
    const Constructor = CatalogService as unknown as new (
      source: FakeDataSource,
      client: FakeEmbeddings,
    ) => CatalogService;
    const service = new Constructor(dataSource, embeddings);

    await service.createAdmin(sku.org_id, {
      sku_code: sku.sku_code,
      name: sku.name,
      description: null,
      attributes: {},
      base_price_minor: sku.base_price_minor,
      cost_minor: sku.cost_minor,
      currency: 'EUR',
      lead_time_days: 7,
    });

    expect(embeddings.embed).toHaveBeenCalledWith(expect.stringContaining(sku.sku_code));
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('"embedding" = $1::vector'),
      ['[0.25,0.5]', sku.id, sku.org_id],
    );
  });

  it('sets the tenant RLS context inside the worker transaction before re-embedding', async () => {
    const manager = {
      query: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(sku),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    type TestManager = typeof manager;
    const dataSource = {
      transaction: vi.fn(async (work: (transactionManager: TestManager) => unknown) =>
        work(manager),
      ),
    };
    const embeddings = { embed: vi.fn().mockResolvedValue([0.25, 0.5]) };
    const service = new CatalogService(dataSource as never, embeddings as never);

    await expect(service.refreshAdminEmbedding(sku.org_id, sku.id)).resolves.toBe(true);

    expect(manager.query).toHaveBeenNthCalledWith(1, 'SELECT set_config($1, $2, true)', [
      'app.org_id',
      sku.org_id,
    ]);
    expect(manager.findOne).toHaveBeenCalledWith(expect.anything(), {
      where: { id: sku.id, org_id: sku.org_id, embedding_status: 'pending' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.query).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE "skus"'), [
      '[0.25,0.5]',
      sku.id,
      sku.org_id,
    ]);
  });

  it('scans pending embeddings per organization under that organization RLS context', async () => {
    const manager = {
      query: vi.fn().mockResolvedValue([]),
      find: vi.fn().mockResolvedValue([{ id: sku.id, org_id: sku.org_id }]),
    };
    type TestManager = typeof manager;
    const dataSource = {
      query: vi.fn().mockResolvedValue([{ id: sku.org_id }]),
      transaction: vi.fn(async (work: (transactionManager: TestManager) => unknown) =>
        work(manager),
      ),
    };
    const service = new CatalogService(dataSource as never);

    await expect(service.listPendingAdminEmbeddings()).resolves.toEqual([
      { orgId: sku.org_id, skuId: sku.id },
    ]);

    expect(manager.query).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [
      'app.org_id',
      sku.org_id,
    ]);
    expect(manager.find).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        where: { org_id: sku.org_id, embedding_status: 'pending' },
        take: 100,
      }),
    );
  });
});
