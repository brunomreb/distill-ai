import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { Vertical } from '../lib/vertical';

/** One demo org (GET /organizations); AUTH_ENABLED=false lets the client pick either via
 * X-Demo-Org-Id (see api/demoOrg.ts). */
export interface Organization {
  id: string;
  name: string;
  vertical: Vertical;
}

export const organizationKeys = {
  all: () => ['organizations'] as const,
  list: () => [...organizationKeys.all(), 'list'] as const,
};

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await client.get<{ data: Organization[] }>('/organizations');
  return res.data.data;
}

/** The org list barely ever changes within a demo session, so it's fetched once and kept fresh
 * for the lifetime of the query client (until onboarding invalidates it — see useCreateOrganization). */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: fetchOrganizations,
    staleTime: Infinity,
  });
}

export interface CreateOrganizationPayload {
  name: string;
  vertical: Vertical;
}

export async function createOrganization(
  payload: CreateOrganizationPayload,
): Promise<Organization> {
  const res = await client.post<{ data: Organization }>('/organizations/onboarding', payload);
  return res.data.data;
}

/** Onboards a new demo org. Only fetches/invalidates here — selecting the new org in the switcher
 * and navigating to the admin screen is the caller's job (Settings' onboarding form), since that
 * needs <OrgProvider>'s setSelectedOrgId, which this API module must not depend on. */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.list() }),
  });
}
