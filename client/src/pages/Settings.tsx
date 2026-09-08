import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { useOrg } from '../hooks/useOrg';
import { useCreateOrganization } from '../api/organizations';
import type { Role } from '../context/RoleContext';
import type { Vertical } from '../lib/vertical';
import { verticalLabels } from '../lib/vertical';
import { ErrorBanner } from '../components/inbox/ErrorBanner';
import { GENERIC_ERROR } from '../lib/errorMessages';

const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: 'RevOps',
    label: 'RevOps',
    description:
      'Acesso total: pedidos, orçamentos, catálogo e análise. Persona de demonstração: Avery Reed.',
  },
  {
    value: 'Sales',
    label: 'Vendas',
    description: 'Apenas pedidos e orçamentos, sem acesso ao catálogo nem à análise.',
  },
  {
    value: 'Admin',
    label: 'Admin',
    description: 'Acesso total + controlos de administração futuros. Igual a RevOps nesta versão.',
  },
];

const SALES_RESTRICTED = ['/catalog', '/analytics'];

const THRESHOLDS = [
  { label: 'Limiar de aprovação automática', value: '≥ 95%', env: 'AUTO_THRESHOLD' },
  { label: 'Limiar de revisão', value: '≥ 70%', env: 'MATCH_THRESHOLD' },
  { label: 'Limite de envio automático', value: '£3,000', env: 'AUTO_SEND_CAP' },
];

export function Settings() {
  const { role, setRole } = useRole();
  const { organizations, selectedOrgId, setSelectedOrgId } = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const createOrgMutation = useCreateOrganization();
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgVertical, setNewOrgVertical] = useState<Vertical>('avac');
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  // No stored selection means the server default (the AVAC demo org) is in effect; reflect that
  // in the radio group so the control never shows nothing selected once orgs have loaded.
  const effectiveOrgId =
    selectedOrgId ?? organizations.find((org) => org.vertical === 'avac')?.id ?? null;

  function handleRoleChange(next: Role) {
    setRole(next);
    if (next === 'Sales' && SALES_RESTRICTED.includes(location.pathname)) {
      navigate('/');
    }
  }

  function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setOnboardingError(null);
    createOrgMutation.mutate(
      { name: newOrgName.trim(), vertical: newOrgVertical },
      {
        onSuccess: (org) => {
          setSelectedOrgId(org.id);
          navigate('/catalog');
        },
        onError: () => setOnboardingError(GENERIC_ERROR),
      },
    );
  }

  return (
    <div className="px-6 py-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Definições</h1>

      {/* Onboarding: create a new demo org */}
      <section className="bg-surface border border-border rounded-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Nova organização</h2>
        <p className="text-sm text-body-text mb-4">
          Cria uma organização de demonstração para um cliente novo. Depois de criada, vais para a
          Administração, onde configuras por esta ordem: Produtos → Regras → Branding → um pedido de
          teste.
        </p>
        {onboardingError && (
          <div className="mb-3">
            <ErrorBanner message={onboardingError} />
          </div>
        )}
        <form onSubmit={handleCreateOrg} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Nome da organização
            <input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="h-9 rounded-lg border border-border bg-canvas px-3 text-sm text-body-text focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Vertical
            <select
              value={newOrgVertical}
              onChange={(e) => setNewOrgVertical(e.target.value as Vertical)}
              className="h-9 rounded-lg border border-border bg-canvas px-3 text-sm text-body-text focus:border-accent focus:outline-none"
            >
              <option value="avac">{verticalLabels.avac}</option>
              <option value="caixilharia">{verticalLabels.caixilharia}</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={newOrgName.trim().length === 0 || createOrgMutation.isPending}
            className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createOrgMutation.isPending ? 'A criar…' : 'Criar organização'}
          </button>
        </form>
      </section>

      {/* Demo org switcher */}
      <section className="bg-surface border border-border rounded-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Organização de demonstração</h2>
        <p className="text-sm text-body-text mb-4">
          Muda entre as organizações fictícias para ver os dados isolados por vertical
          (AUTH_ENABLED=false).
        </p>
        <div className="flex flex-wrap gap-3">
          {organizations.map((org) => (
            <label
              key={org.id}
              className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-900"
            >
              <input
                type="radio"
                name="demo-org"
                value={org.id}
                checked={effectiveOrgId === org.id}
                onChange={() => setSelectedOrgId(org.id)}
                className="accent-indigo-600"
              />
              {org.name} · {verticalLabels[org.vertical]}
            </label>
          ))}
        </div>
      </section>

      {/* Role switcher */}
      <section className="bg-surface border border-border rounded-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Papel de demonstração</h2>
        <p className="text-sm text-body-text mb-4">
          Muda de persona para ver que itens de navegação e ecrãs cada papel tem disponíveis.
        </p>
        <div className="flex gap-3 mb-4">
          {ROLES.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-900"
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => handleRoleChange(value)}
                className="accent-indigo-600"
              />
              {label}
            </label>
          ))}
        </div>
        {ROLES.filter((r) => r.value === role).map(({ value, description }) => (
          <p key={value} className="text-sm text-body-text">
            <span className="font-medium text-slate-900">{role}</span> - {description}
          </p>
        ))}
      </section>

      {/* Confidence thresholds (read-only in V1) */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Limiares de confiança</h2>
        <p className="text-sm text-body-text mb-4">
          Controlam a aprovação automática e o encaminhamento para revisão. Configurados por
          variável de ambiente.
        </p>
        <ul className="space-y-3">
          {THRESHOLDS.map(({ label, value, env }) => (
            <li key={env} className="flex items-center justify-between text-sm">
              <span className="text-body-text">{label}</span>
              <span className="flex items-center gap-3">
                <span className="font-medium text-slate-900">{value}</span>
                <code className="text-xs text-muted font-mono">{env}</code>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
