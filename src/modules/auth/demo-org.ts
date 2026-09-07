import type { AuthUser } from './interfaces/auth-user.interface';

export const DEFAULT_DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';
export const CAIXILHARIA_DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002';
export const DEMO_ORG_HEADER = 'x-demo-org-id';

const ALLOWED_DEMO_ORGS = new Set([DEFAULT_DEMO_ORG_ID, CAIXILHARIA_DEMO_ORG_ID]);

export function resolveDemoOrgCandidate(candidate?: string): string {
  return candidate && ALLOWED_DEMO_ORGS.has(candidate) ? candidate : DEFAULT_DEMO_ORG_ID;
}

/** Demo-only tenant switch. Unknown IDs fail closed to the default seeded AVAC tenant. */
export function resolveDemoOrgId(headers?: Record<string, string | string[] | undefined>): string {
  const raw = headers?.[DEMO_ORG_HEADER];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return resolveDemoOrgCandidate(candidate);
}

export function demoAuthUser(orgId: string): AuthUser {
  return {
    userId: 'demo-user',
    orgId,
    roles: ['admin', 'estimator'],
    email: 'demo@example.com',
  };
}
