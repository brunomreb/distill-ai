import { fetchOrganizations } from './organizations';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('./client', () => ({
  default: { get: mockGet },
}));

describe('fetchOrganizations', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('GETs /organizations and unwraps the data envelope', async () => {
    const orgs = [
      { id: 'org-avac', name: 'Clima Atlântico', vertical: 'avac' as const },
      { id: 'org-caixilharia', name: 'Vãos do Norte', vertical: 'caixilharia' as const },
    ];
    mockGet.mockResolvedValue({ data: { data: orgs } });

    const result = await fetchOrganizations();

    expect(mockGet).toHaveBeenCalledWith('/organizations');
    expect(result).toBe(orgs);
  });
});
