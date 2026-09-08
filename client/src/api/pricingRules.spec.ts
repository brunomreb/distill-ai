import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import {
  ruleKeys,
  fetchRules,
  createRule,
  updateRule,
  deleteRule,
  useCreateRule,
  useDeleteRule,
} from './pricingRules';
import type { RuleWritePayload } from './pricingRules';

const { mockGet, mockPost, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('./client', () => ({
  default: { get: mockGet, post: mockPost, patch: mockPatch, delete: mockDelete },
}));

const rule = {
  id: 'rule-1',
  vertical: 'avac' as const,
  rule_key: 'pipe_extra',
  rule_type: 'conditional_surcharge',
  config: { threshold: 3, price_per_unit_over: 14.5, unit: 'm' },
  sort_order: 2,
  active: true,
};

const writePayload: RuleWritePayload = {
  vertical: 'avac',
  rule_key: 'pipe_extra',
  rule_type: 'conditional_surcharge',
  config: { threshold: 3, price_per_unit_over: 14.5, unit: 'm' },
  sort_order: 2,
  active: true,
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('ruleKeys', () => {
  it('list() nests under all()', () => {
    expect(ruleKeys.list()).toEqual([...ruleKeys.all(), 'list']);
  });
});

describe('fetchRules', () => {
  beforeEach(() => mockGet.mockReset());

  it('GETs /pricing/admin/rules and unwraps the data envelope', async () => {
    mockGet.mockResolvedValue({ data: { data: [rule] } });
    const result = await fetchRules();
    expect(mockGet).toHaveBeenCalledWith('/pricing/admin/rules');
    expect(result).toEqual([rule]);
  });
});

describe('createRule', () => {
  beforeEach(() => mockPost.mockReset());

  it('POSTs the write payload to /pricing/admin/rules', async () => {
    mockPost.mockResolvedValue({ data: { data: rule } });
    const result = await createRule(writePayload);
    expect(mockPost).toHaveBeenCalledWith('/pricing/admin/rules', writePayload);
    expect(result).toEqual(rule);
  });
});

describe('updateRule', () => {
  beforeEach(() => mockPatch.mockReset());

  it('PATCHes a partial payload to /pricing/admin/rules/:id', async () => {
    mockPatch.mockResolvedValue({ data: { data: { ...rule, active: false } } });
    const result = await updateRule('rule-1', { active: false });
    expect(mockPatch).toHaveBeenCalledWith('/pricing/admin/rules/rule-1', { active: false });
    expect(result.active).toBe(false);
  });
});

describe('deleteRule', () => {
  beforeEach(() => mockDelete.mockReset());

  it('DELETEs /pricing/admin/rules/:id', async () => {
    mockDelete.mockResolvedValue({});
    await deleteRule('rule-1');
    expect(mockDelete).toHaveBeenCalledWith('/pricing/admin/rules/rule-1');
  });
});

describe('useCreateRule', () => {
  beforeEach(() => mockPost.mockReset());

  it('invalidates the rule list on success', async () => {
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockPost.mockResolvedValue({ data: { data: rule } });

    const { result } = renderHook(() => useCreateRule(), { wrapper: makeWrapper(queryClient) });
    await act(async () => {
      result.current.mutate(writePayload);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ruleKeys.list() });
  });
});

describe('useDeleteRule', () => {
  beforeEach(() => mockDelete.mockReset());

  it('invalidates the rule list on success', async () => {
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockDelete.mockResolvedValue({});

    const { result } = renderHook(() => useDeleteRule(), { wrapper: makeWrapper(queryClient) });
    await act(async () => {
      result.current.mutate('rule-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ruleKeys.list() });
  });
});
