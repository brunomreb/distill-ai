import { describe, expect, it, vi } from 'vitest';
import { SkuSearchActions } from '../actions/sku-search.actions';

describe('SkuSearchActions catalog lifecycle', () => {
  it('excludes inactive products from lexical and semantic matching', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const actions = new SkuSearchActions({ query } as never);

    await actions.lexicalSearch('unidade', 'org-1', 10);
    await actions.semanticSearch([0.1, 0.2], 'org-1', 10);

    expect(query.mock.calls[0][0]).toMatch(/active = true/);
    expect(query.mock.calls[1][0]).toMatch(/active = true/);
  });
});
