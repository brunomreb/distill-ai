import { useRef, useState } from 'react';
import {
  useAdminSkus,
  useCreateSku,
  useUpdateSku,
  useDeactivateSku,
  useImportCatalog,
} from '../../api/catalog';
import type { Sku, SkuWritePayload, ImportResult } from '../../api/catalog';
import { SkuFormModal } from './SkuFormModal';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorBanner } from '../inbox/ErrorBanner';
import { formatMoney } from '../../lib/formatMoney';
import { GENERIC_ERROR } from '../../lib/errorMessages';

const EMBEDDING_LABELS: Record<Sku['embedding_status'], string> = {
  ready: 'Pronto',
  pending: 'Pendente',
  unavailable: 'Indisponível',
};

type FormTarget = { mode: 'create' } | { mode: 'edit'; sku: Sku };

export function ProductsPanel() {
  const { data: skus, isLoading, isError, refetch } = useAdminSkus();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Sku | null>(null);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useCreateSku();
  const updateMutation = useUpdateSku();
  const deactivateMutation = useDeactivateSku();
  const importMutation = useImportCatalog();

  function handleSubmit(payload: SkuWritePayload) {
    if (formTarget?.mode === 'edit') {
      updateMutation.mutate(
        { id: formTarget.sku.id, payload },
        { onSuccess: () => setFormTarget(null) },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => setFormTarget(null) });
    }
  }

  function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    deactivateMutation.mutate(deactivateTarget.id, { onSuccess: () => setDeactivateTarget(null) });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportSummary(null);
    importMutation.mutate(file, {
      onSuccess: (result: ImportResult) => setImportSummary(result),
      onError: () => setImportError(GENERIC_ERROR),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Produtos</h2>
        <div className="flex items-center gap-2">
          <label className="flex h-9 cursor-pointer items-center rounded-button border border-border px-3 text-sm font-medium text-body-text hover:bg-canvas">
            Importar catálogo
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Importar catálogo"
            />
          </label>
          <button
            type="button"
            onClick={() => setFormTarget({ mode: 'create' })}
            className="h-9 rounded-button bg-accent px-4 text-sm font-medium text-brand-ink hover:bg-accent/90"
          >
            + Novo produto
          </button>
        </div>
      </div>

      {importError && <ErrorBanner message={importError} />}
      {importSummary && (
        <div className="rounded-card border border-border bg-surface p-4 text-sm">
          <p className="font-medium text-slate-900">
            {importSummary.created} criados · {importSummary.updated} atualizados ·{' '}
            {importSummary.rejected} rejeitados
          </p>
          {importSummary.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-error-tx">
              {importSummary.errors.map((err) => (
                <li key={err.row}>
                  Linha {err.row}: {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          A carregar produtos…
        </div>
      ) : isError ? (
        <ErrorBanner
          message="Não foi possível carregar os produtos."
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                {['Código', 'Nome', 'Preço', 'Custo', 'Prazo', 'Catálogo', 'Estado', ''].map(
                  (col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {(skus ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                    Ainda não existem produtos no catálogo.
                  </td>
                </tr>
              ) : (
                (skus ?? []).map((sku) => (
                  <tr key={sku.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-sm text-body-text">{sku.sku_code}</td>
                    <td className="px-4 py-3 text-sm text-body-text">{sku.name}</td>
                    <td className="px-4 py-3 text-sm text-body-text">
                      {formatMoney(sku.base_price_minor, sku.currency)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {sku.cost_minor != null ? formatMoney(sku.cost_minor, sku.currency) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{sku.lead_time_days ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-canvas px-2 py-0.5 text-xs font-medium text-body-text">
                        {EMBEDDING_LABELS[sku.embedding_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">
                      <span className={sku.active ? 'text-hi-tx' : 'text-muted'}>
                        {sku.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setFormTarget({ mode: 'edit', sku })}
                          aria-label={`Editar ${sku.name}`}
                          className="rounded-button border border-border px-2 py-1 text-xs font-medium text-body-text hover:bg-canvas"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeactivateTarget(sku)}
                          disabled={!sku.active}
                          aria-label={`Desativar ${sku.name}`}
                          className="rounded-button border border-border px-2 py-1 text-xs font-medium text-error-tx hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Desativar
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

      <SkuFormModal
        key={formTarget?.mode === 'edit' ? formTarget.sku.id : (formTarget?.mode ?? 'closed')}
        open={formTarget !== null}
        initial={formTarget?.mode === 'edit' ? formTarget.sku : null}
        onSubmit={handleSubmit}
        onClose={() => setFormTarget(null)}
        isPending={createMutation.isPending || updateMutation.isPending}
        error={createMutation.isError || updateMutation.isError ? GENERIC_ERROR : null}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        title={deactivateTarget ? `Desativar ${deactivateTarget.name}` : ''}
        message="O produto deixa de estar disponível para novos orçamentos. Podes reativá-lo mais tarde."
        confirmLabel="Desativar"
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
}
