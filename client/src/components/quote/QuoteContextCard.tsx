interface QuoteContextCardProps {
  confidence: number | null;
  lineCount: number;
  sourceFilename: string | null;
}

/** Match-confidence + source-file card. The summary sentence is composed client-side from
 * already-fetched numbers (line count, confidence) - no dependency on the not-yet-built
 * Copilot/explain_routing module. */
export function QuoteContextCard({ confidence, lineCount, sourceFilename }: QuoteContextCardProps) {
  const pct = confidence !== null ? Math.round(Math.min(Math.max(confidence, 0), 1) * 100) : null;
  const lineSummary = lineCount === 1 ? 'Foi gerada 1 linha' : `Foram geradas ${lineCount} linhas`;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Contexto do orçamento
        </span>
        {pct !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-hi-bg px-2.5 py-0.5 text-xs font-medium text-hi-tx">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-hi-dot" />
            {pct > 0 ? `${pct}% confiança` : 'Revisão humana'}
          </span>
        )}
      </div>

      <p className="text-sm text-body-text">
        {`${lineSummary} de orçamento. Confirma os dados antes de aprovar.`}
      </p>

      {sourceFilename && (
        <span className="inline-flex w-fit items-center rounded bg-canvas px-2 py-1 text-xs text-body-text">
          Origem: {sourceFilename}
        </span>
      )}
    </div>
  );
}
