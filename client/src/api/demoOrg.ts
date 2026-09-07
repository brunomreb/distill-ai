export const DEMO_ORG_HEADER = 'X-Demo-Org-Id';

let currentOrgId: string | null = null;

/** Read by the axios request interceptor on every call; written by <OrgProvider> on selection. */
export function getDemoOrgId(): string | null {
  return currentOrgId;
}

export function setDemoOrgId(id: string | null): void {
  currentOrgId = id;
}

/** Mutates `headers` in place, mirroring how the axios interceptor already sets X-Request-Id.
 * Omitted entirely (not sent empty) when no demo org is selected, so the server keeps its own
 * default (the AVAC demo org). */
export function applyDemoOrgHeader(headers: Record<string, unknown>): void {
  if (currentOrgId) {
    headers[DEMO_ORG_HEADER] = currentOrgId;
  }
}
