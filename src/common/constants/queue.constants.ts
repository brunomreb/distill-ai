export const QUEUES = {
  JOBS: 'jobs',
  PIPELINE: 'pipeline',
  CATALOG: 'catalog',
} as const;

export const JOBS = {
  PROCESS_JOB: 'process-job',
} as const;

// Pipeline graph-engine job (US-E8-4). One job per request run; jobId is
// `pipeline:<requestId>` so Bull deduplicates safe re-enqueues on crash recovery.
export const PIPELINE_JOBS = {
  RUN: 'pipeline:run',
} as const;

export const CATALOG_JOBS = {
  REEMBED: 'catalog:reembed',
  RECOVER_PENDING: 'catalog:recover-pending',
} as const;

/** One live re-embedding job per tenant SKU; completed/failed jobs are removed for future edits. */
export function catalogEmbeddingJobId(orgId: string, skuId: string): string {
  return `catalog-reembed-${orgId}-${skuId}`;
}

export const JOB_RETENTION = {
  COMPLETED_MS: 1000 * 60 * 60 * 24, // 24 h
  FAILED_MS: 1000 * 60 * 60 * 24 * 7, // 7 days
} as const;

// Redis key prefix and TTL for the distributed worker lock.
// TTL must exceed the longest expected job processing time.
export const WORKER_LOCK = {
  KEY_PREFIX: 'job:lock:',
  TTL_SECONDS: 60,
} as const;
