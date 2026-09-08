import { useState } from 'react';
import { useRules, useCreateRule, useUpdateRule, useDeleteRule } from '../../api/pricingRules';
import type { Rule, RuleWritePayload } from '../../api/pricingRules';
import { RuleFormModal } from './RuleFormModal';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorBanner } from '../inbox/ErrorBanner';
import { verticalLabels } from '../../lib/vertical';
import { RULE_TYPE_LABELS } from '../../lib/ruleTypes';
import { GENERIC_ERROR } from '../../lib/errorMessages';

type FormTarget = { mode: 'create' } | { mode: 'edit'; rule: Rule };

export function RulesPanel() {
  const { data: rules, isLoading, isError, refetch } = useRules();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);

  const createMutation = useCreateRule();
  const updateMutation = useUpdateRule();
  const deleteMutation = useDeleteRule();

  function handleSubmit(payload: RuleWritePayload) {
    if (formTarget?.mode === 'edit') {
      updateMutation.mutate(
        { id: formTarget.rule.id, payload },
        { onSuccess: () => setFormTarget(null) },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => setFormTarget(null) });
    }
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Regras de pricing</h2>
        <button
          type="button"
          onClick={() => setFormTarget({ mode: 'create' })}
          className="h-9 rounded-button bg-accent px-4 text-sm font-medium text-brand-ink hover:bg-accent/90"
        >
          + Nova regra
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          A carregar regras…
        </div>
      ) : isError ? (
        <ErrorBanner
          message="Não foi possível carregar as regras."
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                {['Vertical', 'Chave', 'Tipo', 'Ordem', 'Estado', ''].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rules ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                    Ainda não existem regras.
                  </td>
                </tr>
              ) : (
                (rules ?? []).map((rule) => (
                  <tr key={rule.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <span className="rounded bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                        {verticalLabels[rule.vertical]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-body-text">{rule.rule_key}</td>
                    <td className="px-4 py-3 text-sm text-body-text">
                      {RULE_TYPE_LABELS[rule.rule_type]}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{rule.sort_order}</td>
                    <td className="px-4 py-3 text-xs font-medium">
                      <span className={rule.active ? 'text-hi-tx' : 'text-muted'}>
                        {rule.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setFormTarget({ mode: 'edit', rule })}
                          aria-label={`Editar ${rule.rule_key}`}
                          className="rounded-button border border-border px-2 py-1 text-xs font-medium text-body-text hover:bg-canvas"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(rule)}
                          aria-label={`Remover ${rule.rule_key}`}
                          className="rounded-button border border-border px-2 py-1 text-xs font-medium text-error-tx hover:bg-canvas"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <RuleFormModal
        key={formTarget?.mode === 'edit' ? formTarget.rule.id : (formTarget?.mode ?? 'closed')}
        open={formTarget !== null}
        initial={formTarget?.mode === 'edit' ? formTarget.rule : null}
        onSubmit={handleSubmit}
        onClose={() => setFormTarget(null)}
        isPending={createMutation.isPending || updateMutation.isPending}
        error={createMutation.isError || updateMutation.isError ? GENERIC_ERROR : null}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget ? `Remover ${deleteTarget.rule_key}` : ''}
        message="A regra deixa de ser aplicada aos orçamentos seguintes. Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
