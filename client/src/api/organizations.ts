import { useQuery } from '@tanstack/react-query';
import client from './client';
import type { Vertical } from '../lib/vertical';

/** One demo org (GET /organizations); AUTH_ENABLED=false lets the client pick either via
 * X-Demo-Org-Id (see api/demoOrg.ts). */
export interface Organization {
  id: string;
  name: string;
  vertical: Vertical;
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await client.get<{ data: Organization[] }>('/organizations');
  return res.data.data;
}

/** The org list barely ever changes within a demo session, so it's fetched once and kept fresh
 * for the lifetime of the query client. */
export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    staleTime: Infinity,
  });
}
