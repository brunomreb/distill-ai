import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Rule, RuleType, RuleWritePayload } from '../../api/pricingRules';
import type { Vertical } from '../../lib/vertical';
import { verticalLabels } from '../../lib/vertical';
import { RULE_TYPE_LABELS, RULE_TYPES } from '../../lib/ruleTypes';
import { parseJsonObjectOrNull } from '../../lib/jsonField';

interface RuleFormModalProps {
  open: boolean;
  initial: Rule | null;
  onSubmit: (payload: RuleWritePayload) => void;
  onClose: () => void;
  isPending: boolean;
  error: string | null;
}

const VERTICALS = Object.keys(verticalLabels) as Vertical[];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

const inputClass =
  'h-9 rounded-lg border border-border bg-canvas px-3 text-sm text-body-text placeholder:text-muted focus:border-accent focus:outline-none';

export function RuleFormModal({
  open,
  initial,
  onSubmit,
  onClose,
  isPending,
  error,
}: RuleFormModalProps) {
  const [vertical, setVertical] = useState<Vertical>(initial?.vertical ?? VERTICALS[0]);
  const [ruleKey, setRuleKey] = useState(initial?.rule_key ?? '');
  const [ruleType, setRuleType] = useState<RuleType>(initial?.rule_type ?? RULE_TYPES[0]);
  const [configRaw, setConfigRaw] = useState(
    initial ? JSON.stringify(initial.config, null, 2) : '',
  );
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!open) return null;

  const isEdit = initial !== null;
  const canSubmit = ruleKey.trim().length > 0 && configRaw.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const configResult = parseJsonObjectOrNull(configRaw);
    if (!configResult.ok) {
      setValidationError(configResult.error);
      return;
    }
    if (configResult.value === null) {
      setValidationError('A configuração é obrigatória.');
      return;
    }

    const sortOrderValue = Number(sortOrder);
    if (!Number.isFinite(sortOrderValue)) {
      setValidationError('Ordem inválida.');
      return;
    }

    onSubmit({
      vertical,
      rule_key: ruleKey.trim(),
      rule_type: ruleType,
      config: configResult.value,
      sort_order: sortOrderValue,
      active,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Editar ${initial.rule_key}` : 'Nova regra'}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-card border border-border bg-surface p-6"
      >
        <h2 className="text-base font-semibold text-slate-900">
          {isEdit ? `Editar ${initial.rule_key}` : 'Nova regra'}
        </h2>

        {(validationError ?? error) && (
          <p role="alert" className="mt-2 text-sm text-error-tx">
            {validationError ?? error}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vertical">
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value as Vertical)}
                className={inputClass}
              >
                {VERTICALS.map((v) => (
                  <option key={v} value={v}>
                    {verticalLabels[v]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de regra">
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as RuleType)}
                className={inputClass}
              >
                {RULE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {RULE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Chave da regra">
            <input
              value={ruleKey}
              onChange={(e) => setRuleKey(e.target.value)}
              placeholder="pipe_extra"
              className={inputClass}
            />
          </Field>
          <Field label="Configuração (JSON)">
            <textarea
              value={configRaw}
              onChange={(e) => setConfigRaw(e.target.value)}
              rows={6}
              placeholder='{ "threshold": 3, "price_per_unit_over": 14.5 }'
              className="rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-xs text-body-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </Field>
          <Field label="Ordem">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="accent-accent"
            />
            Ativa
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-slate-900 hover:bg-canvas"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-brand-ink hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
