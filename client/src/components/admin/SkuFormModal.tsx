import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Sku, SkuWritePayload } from '../../api/catalog';
import { eurosToMinor, minorToEuros } from '../../lib/euroMinor';
import { parseJsonObjectOrNull } from '../../lib/jsonField';

interface SkuFormModalProps {
  open: boolean;
  /** null = create mode; a SKU = edit mode, pre-filled (prices shown in euros). */
  initial: Sku | null;
  onSubmit: (payload: SkuWritePayload) => void;
  onClose: () => void;
  isPending: boolean;
  error: string | null;
}

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

export function SkuFormModal({
  open,
  initial,
  onSubmit,
  onClose,
  isPending,
  error,
}: SkuFormModalProps) {
  const [skuCode, setSkuCode] = useState(initial?.sku_code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priceEuros, setPriceEuros] = useState(
    initial ? String(minorToEuros(initial.base_price_minor)) : '',
  );
  const [costEuros, setCostEuros] = useState(
    initial?.cost_minor != null ? String(minorToEuros(initial.cost_minor)) : '',
  );
  const [currency, setCurrency] = useState(initial?.currency ?? 'EUR');
  const [leadTimeDays, setLeadTimeDays] = useState(
    initial?.lead_time_days != null ? String(initial.lead_time_days) : '',
  );
  const [attributesRaw, setAttributesRaw] = useState(
    initial?.attributes ? JSON.stringify(initial.attributes, null, 2) : '',
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!open) return null;

  const isEdit = initial !== null;
  const canSubmit =
    skuCode.trim().length > 0 && name.trim().length > 0 && priceEuros.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const priceValue = Number(priceEuros);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setValidationError('Preço de venda inválido.');
      return;
    }

    let costMinor: number | null = null;
    if (costEuros.trim().length > 0) {
      const costValue = Number(costEuros);
      if (!Number.isFinite(costValue) || costValue < 0) {
        setValidationError('Custo inválido.');
        return;
      }
      costMinor = eurosToMinor(costValue);
    }

    const attributesResult = parseJsonObjectOrNull(attributesRaw);
    if (!attributesResult.ok) {
      setValidationError(attributesResult.error);
      return;
    }

    const leadTime = leadTimeDays.trim().length > 0 ? Number(leadTimeDays) : null;

    onSubmit({
      sku_code: skuCode.trim(),
      name: name.trim(),
      description: description.trim().length > 0 ? description.trim() : null,
      attributes: attributesResult.value,
      base_price_minor: eurosToMinor(priceValue),
      cost_minor: costMinor,
      currency: currency.trim() || 'EUR',
      lead_time_days: leadTime,
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
        aria-label={isEdit ? `Editar ${initial.name}` : 'Novo produto'}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-card border border-border bg-surface p-6"
      >
        <h2 className="text-base font-semibold text-slate-900">
          {isEdit ? `Editar ${initial.name}` : 'Novo produto'}
        </h2>

        {(validationError ?? error) && (
          <p role="alert" className="mt-2 text-sm text-error-tx">
            {validationError ?? error}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <Field label="Código SKU">
            <input
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Nome">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Descrição">
            <textarea
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-body-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço de venda (€)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceEuros}
                onChange={(e) => setPriceEuros(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Custo (€)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={costEuros}
                onChange={(e) => setCostEuros(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Moeda">
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Prazo de entrega (dias)">
              <input
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Atributos (JSON, opcional)">
            <textarea
              value={attributesRaw}
              onChange={(e) => setAttributesRaw(e.target.value)}
              rows={4}
              placeholder='{ "cor": "branco" }'
              className="rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-xs text-body-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="accent-accent"
            />
            Ativo
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
