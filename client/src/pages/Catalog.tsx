import { useState } from 'react';
import { ProductsPanel } from '../components/admin/ProductsPanel';
import { RulesPanel } from '../components/admin/RulesPanel';
import { BrandingPanel } from '../components/admin/BrandingPanel';

type Tab = 'produtos' | 'regras' | 'branding';

const TABS: { id: Tab; label: string }[] = [
  { id: 'produtos', label: 'Produtos' },
  { id: 'regras', label: 'Regras' },
  { id: 'branding', label: 'Branding' },
];

export function Catalog() {
  const [tab, setTab] = useState<Tab>('produtos');

  return (
    <div className="px-6 py-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Administração</h1>
      <p className="mb-4 text-sm text-body-text">
        Catálogo, regras de pricing e identidade visual da organização.
      </p>

      <div
        role="tablist"
        aria-label="Secções de administração"
        className="mb-4 flex gap-1 border-b border-border"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              tab === t.id
                ? 'border-accent text-slate-900'
                : 'border-transparent text-muted hover:text-slate-900',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'produtos' && <ProductsPanel />}
      {tab === 'regras' && <RulesPanel />}
      {tab === 'branding' && <BrandingPanel />}
    </div>
  );
}
