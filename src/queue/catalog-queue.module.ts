import { Module } from '@nestjs/common';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { QueueClientModule } from './queue-client.module';
import { CatalogEmbeddingProcessor } from './processors/catalog-embedding.processor';

/** Registers catalog background work only in the worker process. */
@Module({
  imports: [QueueClientModule, CatalogModule],
  providers: [CatalogEmbeddingProcessor],
})
export class CatalogQueueModule {}
