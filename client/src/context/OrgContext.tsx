/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizations } from '../api/organizations';
import type { Organization } from '../api/organizations';
import { setDemoOrgId } from '../api/demoOrg';

export const STORAGE_KEY = 'stratos.demoOrgId';

export interface OrgContextValue {
  organizations: Organization[];
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string) => void;
  isLoading: boolean;
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

export function OrgProvider({ children }: { children: ReactNode }) {
  const { data: organizations, isLoading } = useOrganizations();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(readStoredOrgId);

  // A stored id can outlive the org it named (seed reset, demo data wiped). Resetting the React
  // state itself happens during render (React's sanctioned pattern for deriving state from a prop
  // change, see "Storing information from previous renders") rather than in an effect, so it never
  // costs an extra commit. The side effects that follow from a real selection change — the axios
  // header, localStorage, and query invalidation — are handled uniformly below, keyed off
  // selectedOrgId, so they fire whether the change came from the user or from this reset.
  const [checkedOrgs, setCheckedOrgs] = useState<Organization[] | undefined>(undefined);
  if (organizations && organizations !== checkedOrgs) {
    setCheckedOrgs(organizations);
    if (selectedOrgId && !organizations.some((org) => org.id === selectedOrgId)) {
      setSelectedOrgIdState(null);
    }
  }

  useEffect(() => {
    // Order matters: the header must land before any query this invalidation wakes up refetches.
    // Runs on every selectedOrgId change, mount included — a stale-id reset can follow an
    // org list that only arrived after children already fetched under the wrong header, so
    // there's no "first run is always safe to skip" case to special-case here.
    setDemoOrgId(selectedOrgId);
    writeStoredOrgId(selectedOrgId);
    void queryClient.invalidateQueries();
  }, [selectedOrgId, queryClient]);

  function setSelectedOrgId(id: string) {
    setSelectedOrgIdState(id);
  }

  return (
    <OrgContext.Provider
      value={{ organizations: organizations ?? [], selectedOrgId, setSelectedOrgId, isLoading }}
    >
      {children}
    </OrgContext.Provider>
  );
}
