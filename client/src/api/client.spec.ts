import client from './client';
import { setDemoOrgId, DEMO_ORG_HEADER } from './demoOrg';

function runRequestInterceptor(config: { headers: Record<string, unknown> }) {
  const { handlers } = client.interceptors.request as unknown as {
    handlers: Array<{ fulfilled: (c: typeof config) => typeof config }>;
  };
  return handlers[0]!.fulfilled(config);
}

describe('client request interceptor', () => {
  afterEach(() => {
    setDemoOrgId(null);
  });

  it('adds the demo org header when an org is selected', () => {
    setDemoOrgId('org-avac');

    const config = runRequestInterceptor({ headers: {} });

    expect(config.headers[DEMO_ORG_HEADER]).toBe('org-avac');
  });

  it('omits the demo org header when no org is selected', () => {
    const config = runRequestInterceptor({ headers: {} });

    expect(config.headers[DEMO_ORG_HEADER]).toBeUndefined();
  });
});
