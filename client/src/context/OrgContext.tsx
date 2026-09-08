/* eslint-disable react-refresh/only-export-components */
import { createContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizations } from '../api/organizations';
import type { Organization } from '../api/organizations';
import { setDemoOrgId } from '../api/demoOrg';
import { ErrorBanner } from '../components/inbox/ErrorBanner';

export const STORAGE_KEY = 'stratos.demoOrgId';

export interface OrgContextValue {
  organizations: Organization[];
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string) => void;
}

export const OrgContext = createContext<OrgContextValue | null>(null);

function readStoredOrgId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrgId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // swallow: in-memory state still updates
  }
}

// Runs once, synchronously, the instant this module is evaluated — before <OrgProvider> itself
// mounts, let alone its children. A hard reload with a persisted org must not let the first
// requests fire headerless while waiting for a post-mount effect to catch up.
setDemoOrgId(readStoredOrgId());

/**
 * Blocks children until the org list has loaded and the persisted selection has been validated
 * against it. No setState ever runs during render or inside an effect: the raw selection lives in
 * React state (only ever written from the explicit setSelectedOrgId call below, a plain event
 * handler — never an effect), and the validated value used everywhere else is derived from it on
 * every render. Because children don't exist in the tree until that derivation has happened,
 * there's no commit in which a child (or its own mount effect) can observe a stale or invalid
 * X-Demo-Org-Id header.
 */
export function OrgProvider({ children }: { children: ReactNode }) {
  const { data: organizations, isLoading, isError, refetch } = useOrganizations();
  const queryClient = useQueryClient();
  const [rawSelectedOrgId, setRawSelectedOrgId] = useState<string | null>(readStoredOrgId);

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-6">
        <ErrorBanner
          message="Não foi possível carregar as organizações."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (isLoading || !organizations) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-6 text-sm text-muted">
        A validar organização…
      </div>
    );
  }

  const selectedOrgId =
    rawSelectedOrgId && organizations.some((org) => org.id === rawSelectedOrgId)
      ? rawSelectedOrgId
      : null;

  // Keeps the axios header and localStorage in lockstep with the validated selection above,
  // synchronously during render (not an effect) — setDemoOrgId/writeStoredOrgId are plain module
  // functions, not React state setters, so this isn't a React setState-during-render.
  setDemoOrgId(selectedOrgId);
  writeStoredOrgId(selectedOrgId);

  function setSelectedOrgId(id: string) {
    // Order matters: the header must land before invalidateQueries wakes any query that reads it.
    setDemoOrgId(id);
    writeStoredOrgId(id);
    setRawSelectedOrgId(id);
    void queryClient.invalidateQueries();
  }

  return (
    <OrgContext.Provider value={{ organizations, selectedOrgId, setSelectedOrgId }}>
      {children}
    </OrgContext.Provider>
  );
}
