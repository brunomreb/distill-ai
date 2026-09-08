import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Sku } from './entities/sku.entity';
import { EmbeddingsClientService } from './embeddings-client.service';
import { isEuroCurrency, STRATOS_CURRENCY } from '@common/constants/currency.constants';

/** One catalog SKU returned by the manual search in the re-map drawer (US-E6-2). */
export interface SkuSearchResult {
  sku_id: string;
  sku_code: string;
  name: string;
  description: string | null;
  base_price_minor: number;
  currency: string;
  lead_time_days: number | null;
  score: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

export interface AdminSkuInput {
  sku_code: string;
  name: string;
  description: string | null;
  attributes: Record<string, unknown> | null;
  base_price_minor: number;
  cost_minor: number | null;
  currency: string;
  lead_time_days: number | null;
  active?: boolean;
}

export type AdminSkuPatch = Partial<AdminSkuInput> & { active?: boolean };

export interface PendingAdminEmbedding {
  orgId: string;
  skuId: string;
}

/**
 * Catalog SKU search for the re-map drawer's manual fallback (US-E6-2 FR-1). Lexical pg_trgm match
 * over sku_code / name / description, org-scoped when a caller org is known (SEC-02). It mirrors the
 * matching pipeline's lexical retrieval but returns the price fields the drawer renders.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly embeddings?: EmbeddingsClientService,
  ) {}

  /** Returns SKUs ranked by trigram similarity to the query; org-scoped when orgId is provided. */
  async searchSkus(
    query: string,
    orgId: string | undefined,
    limit = DEFAULT_LIMIT,
    entityManager?: EntityManager,
  ): Promise<SkuSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [];
    }
    const cappedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const haystack = `COALESCE(sku_code, '') || ' ' || COALESCE(name, '') || ' ' || COALESCE(description, '')`;

    // Org filter is applied as an extra predicate only when a caller org is known, so single-tenant
    // dev (auth disabled) still returns results while a real caller never sees another org's SKUs.
    const params: unknown[] = [trimmed];
    let orgClause = '';
    if (orgId !== undefined) {
      params.push(orgId);
      orgClause = `AND org_id = $${params.length}`;
    }
    params.push(cappedLimit);
    const limitParam = `$${params.length}`;

    return (entityManager ?? this.dataSource).query(
      `SELECT id AS sku_id, sku_code, name, description, base_price_minor, currency, lead_time_days,
              word_similarity($1, ${haystack}) AS score
         FROM skus
        WHERE $1 <% (${haystack})
          AND active = true
          ${orgClause}
        ORDER BY score DESC
        LIMIT ${limitParam}`,
      params,
    );
  }

  /** Full tenant catalog for the administration screen, including inactive historical rows. */
  async listAdmin(orgId: string, entityManager?: EntityManager): Promise<Sku[]> {
    return (entityManager ?? this.dataSource.manager).find(Sku, {
      where: { org_id: orgId },
      order: { sku_code: 'ASC' },
    });
  }

  /** Creates one active tenant SKU. Text used for matching is normalized before persistence. */
  async createAdmin(
    orgId: string,
    input: AdminSkuInput,
    entityManager?: EntityManager,
  ): Promise<Sku> {
    if (!isEuroCurrency(input.currency)) {
      throw new BadRequestException('A moeda tem de ser EUR.');
    }
    const manager = entityManager ?? this.dataSource.manager;
    const saved = await manager.save(Sku, {
      ...input,
      org_id: orgId,
      sku_code: input.sku_code.trim().toUpperCase(),
      name: input.name.trim(),
      currency: STRATOS_CURRENCY,
      attributes: input.attributes ?? {},
      active: input.active ?? true,
      embedding_status: 'pending',
      embedding_error: null,
    });
    await this.refreshEmbedding(saved, orgId, entityManager);
    return saved;
  }

  /** Updates only a SKU owned by the selected tenant; null means not found in that tenant. */
  async updateAdmin(
    orgId: string,
    skuId: string,
    patch: AdminSkuPatch,
    entityManager?: EntityManager,
  ): Promise<Sku | null> {
    if (patch.currency !== undefined && !isEuroCurrency(patch.currency)) {
      throw new BadRequestException('A moeda tem de ser EUR.');
    }
    const manager = entityManager ?? this.dataSource.manager;
    const normalized: AdminSkuPatch = { ...patch };
    if (patch.sku_code !== undefined) normalized.sku_code = patch.sku_code.trim().toUpperCase();
    if (patch.name !== undefined) normalized.name = patch.name.trim();
    if (patch.currency !== undefined) normalized.currency = STRATOS_CURRENCY;
    if (patch.attributes === null) normalized.attributes = {};

    const result = await manager.update(
      Sku,
      { id: skuId, org_id: orgId },
      normalized as QueryDeepPartialEntity<Sku>,
    );
    if ((result.affected ?? 0) === 0) return null;
    const updated = await manager.findOne(Sku, {
      where: { id: skuId, org_id: orgId },
    });
    if (
      updated &&
      (patch.sku_code !== undefined ||
        patch.name !== undefined ||
        patch.description !== undefined ||
        patch.attributes !== undefined)
    ) {
      await this.refreshEmbedding(updated, orgId, entityManager);
    }
    return updated;
  }

  /** Soft-deactivates a SKU so historical quote foreign keys remain intact. */
  async deactivateAdmin(
    orgId: string,
    skuId: string,
    entityManager?: EntityManager,
  ): Promise<Sku | null> {
    return this.updateAdmin(orgId, skuId, { active: false }, entityManager);
  }

  /** Rebuilds one tenant SKU vector from a worker job; stale/deleted ids are harmless no-ops. */
  async refreshAdminEmbedding(orgId: string, skuId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      await this.setTenantContext(manager, orgId);
      const sku = await manager.findOne(Sku, {
        where: { id: skuId, org_id: orgId, embedding_status: 'pending' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sku) return false;
      await this.refreshEmbedding(sku, orgId, manager);
      return true;
    });
  }

  /** Finds imports whose post-commit enqueue was interrupted so the worker can reconcile them. */
  async listPendingAdminEmbeddings(limitPerOrg = 100): Promise<PendingAdminEmbedding[]> {
    const organizations = (await this.dataSource.query(
      'SELECT "id" FROM "organizations" ORDER BY "id"',
    )) as Array<{ id: string }>;
    const pending: PendingAdminEmbedding[] = [];
    for (const { id: orgId } of organizations) {
      const rows = await this.dataSource.transaction(async (manager) => {
        await this.setTenantContext(manager, orgId);
        return manager.find(Sku, {
          select: { id: true, org_id: true },
          where: { org_id: orgId, embedding_status: 'pending' },
          order: { updated_at: 'ASC' },
          take: limitPerOrg,
        });
      });
      pending.push(...rows.map((sku) => ({ orgId: sku.org_id, skuId: sku.id })));
    }
    return pending;
  }

  private async refreshEmbedding(
    sku: Sku,
    orgId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    if (!this.embeddings) return;
    try {
      const vector = await this.embeddings.embed(
        [sku.sku_code, sku.name, sku.description, JSON.stringify(sku.attributes)]
          .filter(Boolean)
          .join(' '),
      );
      await (entityManager ?? this.dataSource).query(
        `UPDATE "skus" SET "embedding" = $1::vector, "embedding_status" = 'ready', "embedding_error" = NULL, "updated_at" = now() WHERE "id" = $2 AND "org_id" = $3`,
        [`[${vector.join(',')}]`, sku.id, orgId],
      );
      sku.embedding_status = 'ready';
      sku.embedding_error = null;
    } catch (error) {
      const message = (error instanceof Error ? error.message : 'indisponível').slice(0, 500);
      await (entityManager ?? this.dataSource.manager).update(
        Sku,
        { id: sku.id, org_id: orgId },
        { embedding_status: 'unavailable', embedding_error: message },
      );
      sku.embedding_status = 'unavailable';
      sku.embedding_error = message;
    }
  }

  private async setTenantContext(manager: EntityManager, orgId: string): Promise<void> {
    await manager.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);
  }
}
