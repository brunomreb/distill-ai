import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { Vertical } from '../lib/vertical';

/** rule_type values from the build spec (section 5): each shapes `config` differently. */
export type RuleType =
  | 'catalog_unit'
  | 'included_allowance'
  | 'conditional_surcharge'
  | 'fixed_adder'
  | 'labor_hours'
  | 'margin_markup'
  | 'tax';

/** One pricing rule as managed in the admin CRUD (GET/POST/PATCH/DELETE /pricing/admin/rules). */
export interface Rule {
  id: string;
  vertical: Vertical;
  rule_key: string;
  rule_type: RuleType;
  config: Record<string, unknown>;
  sort_order: number;
  active: boolean;
}

/** The writable fields of a rule: same shape as Rule minus the server-owned id. */
export type RuleWritePayload = Omit<Rule, 'id'>;

export const ruleKeys = {
  all: () => ['pricing', 'admin', 'rules'] as const,
  list: () => [...ruleKeys.all(), 'list'] as const,
};

export async function fetchRules(): Promise<Rule[]> {
  const res = await client.get<{ data: Rule[] }>('/pricing/admin/rules');
  return res.data.data;
}

export function useRules() {
  return useQuery({ queryKey: ruleKeys.list(), queryFn: fetchRules });
}

export async function createRule(payload: RuleWritePayload): Promise<Rule> {
  const res = await client.post<{ data: Rule }>('/pricing/admin/rules', payload);
  return res.data.data;
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ruleKeys.list() }),
  });
}

export async function updateRule(id: string, payload: Partial<RuleWritePayload>): Promise<Rule> {
  const res = await client.patch<{ data: Rule }>(`/pricing/admin/rules/${id}`, payload);
  return res.data.data;
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RuleWritePayload> }) =>
      updateRule(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ruleKeys.list() }),
  });
}

export async function deleteRule(id: string): Promise<void> {
  await client.delete(`/pricing/admin/rules/${id}`);
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ruleKeys.list() }),
  });
}
