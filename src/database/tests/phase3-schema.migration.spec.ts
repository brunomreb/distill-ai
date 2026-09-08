import { describe, expect, it, vi } from 'vitest';
import { AddPhase3Administration1782610000000 } from '../migrations/1782610000000-AddPhase3Administration';

function queryRunner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('AddPhase3Administration1782610000000', () => {
  it('adds tenant onboarding, catalog lifecycle and quote delivery fields', async () => {
    const runner = queryRunner();

    await new AddPhase3Administration1782610000000().up(runner as never);

    const sql = runner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('"organizations" ADD COLUMN "demo_enabled"');
    expect(sql).toContain('"skus" ADD COLUMN "active"');
    expect(sql).toContain('"skus" ADD COLUMN "embedding_status"');
    expect(sql).toContain('"quotes" ADD COLUMN "email_sent_at"');
    expect(sql).toContain('"quotes" ADD COLUMN "email_recipient"');
    expect(sql).toContain('"quotes" ADD COLUMN "email_provider_message_id"');
    expect(sql).toContain('"quotes" ADD COLUMN "email_delivery_started_at"');
    expect(sql).toContain('CREATE INDEX "skus_org_active_idx"');
  });

  it('reverses every Phase 3 schema change without deleting tenant data', async () => {
    const runner = queryRunner();

    await new AddPhase3Administration1782610000000().down(runner as never);

    const sql = runner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('DROP INDEX IF EXISTS "skus_org_active_idx"');
    expect(sql).toContain('"quotes" DROP COLUMN IF EXISTS "email_provider_message_id"');
    expect(sql).toContain('"quotes" DROP COLUMN IF EXISTS "email_delivery_started_at"');
    expect(sql).toContain('"quotes" DROP COLUMN IF EXISTS "email_recipient"');
    expect(sql).toContain('"quotes" DROP COLUMN IF EXISTS "email_sent_at"');
    expect(sql).toContain('"skus" DROP COLUMN IF EXISTS "embedding_status"');
    expect(sql).toContain('"skus" DROP COLUMN IF EXISTS "active"');
    expect(sql).toContain('"organizations" DROP COLUMN IF EXISTS "demo_enabled"');
    expect(sql).not.toMatch(/DELETE FROM "organizations"/);
  });
});
