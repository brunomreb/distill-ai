import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { DataSource, QueryRunner, EntityManager } from 'typeorm';
import { AuthService } from '../services/auth.service';
import { authConfig } from '@config/auth.config';
import type { Response } from 'express';
import type { AfterCommitTask, WithAfterCommit } from '@common/http/after-commit';
import type { AuthUser } from '../interfaces/auth-user.interface';
import { demoAuthUser, requestedDemoOrgId, resolveDemoOrgId } from '../demo-org';

interface RlsRequest extends WithAfterCommit {
  headers?: Record<string, string | string[] | undefined>;
  queryRunner?: QueryRunner;
  entityManager?: EntityManager;
  user?: AuthUser;
}

@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RlsContextMiddleware.name);

  constructor(
    private dataSource: DataSource,
    private authService: AuthService,
  ) {}

  async use(
    request: RlsRequest,
    response: Response,
    next: (error?: unknown) => void,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let hasError = false;
    const wrappedNext: typeof next = (error) => {
      if (error) hasError = true;
      next(error);
    };

    try {
      let orgId = resolveDemoOrgId(request.headers);
      if (authConfig.enabled) {
        const token = this.authService.extractToken(request);
        if (token) {
          const decoded = this.authService.validateToken(token);
          orgId = decoded.orgId;
          request.user = this.authService.buildAuthUser(decoded);
        }
      } else {
        const requested = requestedDemoOrgId(request.headers);
        if (
          requested &&
          requested !== orgId &&
          /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requested)
        ) {
          const rows = (await queryRunner.query(
            `SELECT "id" FROM "organizations" WHERE "id" = $1 AND "demo_enabled" = true LIMIT 1`,
            [requested],
          )) as Array<{ id: string }> | undefined;
          if (rows?.length) orgId = requested;
        }
        request.user = demoAuthUser(orgId);
      }

      await queryRunner.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);

      request.queryRunner = queryRunner;
      request.entityManager = queryRunner.manager;
      const afterCommit: AfterCommitTask[] = [];
      request.afterCommit = afterCommit;

      response.on('finish', async () => {
        try {
          if (queryRunner.isReleased) return;
          if (hasError || response.statusCode >= 400) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            return;
          }
          await queryRunner.commitTransaction();
          await queryRunner.release();
          // Only now that the rows are durably visible to other connections do we run post-commit
          // side effects (e.g. enqueueing the pipeline). Running them mid-transaction lets the worker
          // read a not-yet-committed request and drop the job as not-found (issue #93). One failing
          // task must not skip the rest.
          for (const task of afterCommit) {
            try {
              await task();
            } catch (taskError) {
              this.logger.error('After-commit task failed:', taskError);
            }
          }
        } catch (error) {
          this.logger.error('Failed to finalize RLS transaction:', error);
        }
      });

      response.on('close', async () => {
        try {
          if (!queryRunner.isReleased) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
          }
        } catch (error) {
          this.logger.error('Failed to rollback on close:', error);
        }
      });
    } catch (error) {
      try {
        if (!queryRunner.isReleased) {
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
        }
      } catch (cleanupError) {
        this.logger.error('RLS cleanup error:', cleanupError);
      }
      this.logger.error('RLS context error:', error);
      wrappedNext(error);
      return;
    }

    wrappedNext();
  }
}
