import { describe, expect, it, vi } from 'vitest';
import { EnforceEuroCurrency1782620000000 } from '../migrations/1782620000000-EnforceEuroCurrency';

function queryRunner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('EnforceEuroCurrency1782620000000', () => {
  it('purges legacy demo money without relabelling it and constrains active data to EUR', async () => {
    const runner = queryRunner();

    await new EnforceEuroCurrency1782620000000().up(runner as never);

    const sql = runner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain(`DELETE FROM "quotes"`);
    expect(sql).toContain(`DELETE FROM "skus"`);
    expect(sql).not.toContain(`UPDATE "quotes" SET "currency" = 'EUR'`);
    expect(sql).not.toContain(`UPDATE "skus" SET "currency" = 'EUR'`);
    expect(sql).toContain(`ALTER COLUMN "currency" SET DEFAULT 'EUR'`);
    expect(sql).toContain('skus_currency_eur_check');
    expect(sql).toContain('quotes_currency_eur_check');
    expect(sql).toContain(`CHECK ("currency" = 'EUR')`);
  });

  it('removes the EUR-only constraints while retaining safe EUR defaults on rollback', async () => {
    const runner = queryRunner();

    await new EnforceEuroCurrency1782620000000().down(runner as never);

    const sql = runner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS "quotes_currency_eur_check"');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS "skus_currency_eur_check"');
    expect(sql).toContain(`ALTER COLUMN "currency" SET DEFAULT 'EUR'`);
  });
});
