import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { CATALOG_JOBS, QUEUES, catalogEmbeddingJobId } from '@common/constants/queue.constants';
import { CatalogService } from '@modules/catalog/catalog.service';
import { env } from '@config/env';

interface CatalogEmbeddingJob {
  orgId: string;
  skuId: string;
}

/** Worker-only consumer; API requests persist imports before any external embedding call. */
@Processor(QUEUES.CATALOG)
export class CatalogEmbeddingProcessor implements OnModuleInit {
  private readonly logger = new Logger(CatalogEmbeddingProcessor.name);

  constructor(
    private readonly catalog: CatalogService,
    @InjectQueue(QUEUES.CATALOG) private readonly queue: Queue,
  ) {}

  /** Bull persists this repeat schedule in Redis, providing recovery after API/worker crashes. */
  async onModuleInit(): Promise<void> {
    await this.queue.add(
      CATALOG_JOBS.RECOVER_PENDING,
      {},
      { repeat: { every: 300_000 }, attempts: 1, removeOnComplete: true },
    );
  }

  @Process({ name: CATALOG_JOBS.REEMBED, concurrency: env.QUEUE_CONCURRENCY })
  async handle(job: Job<CatalogEmbeddingJob>): Promise<void> {
    const found = await this.catalog.refreshAdminEmbedding(job.data.orgId, job.data.skuId);
    if (!found) {
      this.logger.warn({ event: 'catalog_embedding_sku_not_found', ...job.data });
    }
  }

  @Process({ name: CATALOG_JOBS.RECOVER_PENDING, concurrency: 1 })
  async recoverPending(): Promise<void> {
    const pending = await this.catalog.listPendingAdminEmbeddings();
    for (const item of pending) {
      await this.queue.add(CATALOG_JOBS.REEMBED, item, {
        jobId: catalogEmbeddingJobId(item.orgId, item.skuId),
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      });
    }
  }
}
