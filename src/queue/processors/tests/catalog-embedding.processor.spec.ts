import { describe, expect, it, vi } from 'vitest';
import { CatalogEmbeddingProcessor } from '../catalog-embedding.processor';

describe('CatalogEmbeddingProcessor', () => {
  it('re-embeds only the tenant SKU named by the durable job', async () => {
    const catalog = { refreshAdminEmbedding: vi.fn().mockResolvedValue(true) };
    const processor = new CatalogEmbeddingProcessor(catalog as never, { add: vi.fn() } as never);

    await processor.handle({ data: { orgId: 'org-1', skuId: 'sku-1' } } as never);

    expect(catalog.refreshAdminEmbedding).toHaveBeenCalledWith('org-1', 'sku-1');
  });

  it('registers a repeatable recovery scan for imports stranded before enqueue', async () => {
    const queue = { add: vi.fn().mockResolvedValue({ id: 'recovery' }) };
    const processor = new CatalogEmbeddingProcessor(
      { refreshAdminEmbedding: vi.fn() } as never,
      queue as never,
    );

    await processor.onModuleInit();

    expect(queue.add).toHaveBeenCalledWith(
      'catalog:recover-pending',
      {},
      expect.objectContaining({ repeat: { every: 300_000 } }),
    );
  });

  it('re-enqueues pending tenant rows found by the recovery scan', async () => {
    const catalog = {
      listPendingAdminEmbeddings: vi
        .fn()
        .mockResolvedValue([{ orgId: 'org-1', skuId: 'sku-pending' }]),
    };
    const queue = { add: vi.fn().mockResolvedValue({ id: 'retry' }) };
    const processor = new CatalogEmbeddingProcessor(catalog as never, queue as never);

    await processor.recoverPending();

    expect(queue.add).toHaveBeenCalledWith(
      'catalog:reembed',
      { orgId: 'org-1', skuId: 'sku-pending' },
      expect.objectContaining({
        jobId: 'catalog-reembed-org-1-sku-pending',
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: true,
      }),
    );
  });
});
