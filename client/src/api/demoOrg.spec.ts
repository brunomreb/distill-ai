import { getDemoOrgId, setDemoOrgId, applyDemoOrgHeader, DEMO_ORG_HEADER } from './demoOrg';

describe('demoOrg', () => {
  afterEach(() => {
    setDemoOrgId(null);
  });

  it('has no selected org by default', () => {
    expect(getDemoOrgId()).toBeNull();
  });

  it('returns whatever id was last set', () => {
    setDemoOrgId('org-avac');
    expect(getDemoOrgId()).toBe('org-avac');
  });

  it('applyDemoOrgHeader adds the header when an org is selected', () => {
    setDemoOrgId('org-caixilharia');
    const headers: Record<string, string> = {};

    applyDemoOrgHeader(headers);

    expect(headers[DEMO_ORG_HEADER]).toBe('org-caixilharia');
  });

  it('applyDemoOrgHeader leaves headers untouched when no org is selected', () => {
    const headers: Record<string, string> = {};

    applyDemoOrgHeader(headers);

    expect(headers[DEMO_ORG_HEADER]).toBeUndefined();
  });
});
