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

export function OrgProvider({ children }: { children: ReactNode }) {
  const { data: organizations, isLoading } = useOrganizations();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(readStoredOrgId);

  // A stored id can outlive the org it named (seed reset, demo data wiped). Adjust state during
  // render (not an effect) the first time the real list arrives and no longer contains it, so the
  // app falls back to the server default without an extra render pass.
  const [checkedOrgs, setCheckedOrgs] = useState<Organization[] | undefined>(undefined);
  if (organizations && organizations !== checkedOrgs) {
    setCheckedOrgs(organizations);
    if (selectedOrgId && !organizations.some((org) => org.id === selectedOrgId)) {
      setSelectedOrgIdState(null);
    }
  }

  useEffect(() => {
    setDemoOrgId(selectedOrgId);
  }, [selectedOrgId]);

  function setSelectedOrgId(id: string) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // swallow: selection still updates in memory
    }
    setSelectedOrgIdState(id);
    void queryClient.invalidateQueries();
  }

  return (
    <OrgContext.Provider
      value={{ organizations: organizations ?? [], selectedOrgId, setSelectedOrgId, isLoading }}
    >
      {children}
    </OrgContext.Provider>
  );
}
