import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authState } = vi.hoisted(() => ({ authState: { enabled: false } }));
vi.mock('@config/auth.config', () => ({ authConfig: authState }));

import type { Repository } from 'typeorm';
import { OrganizationsController } from './organizations.controller';
import type { Organization } from './entities/organization.entity';

const organizations = [
  { id: '00000000-0000-0000-0000-000000000000', name: 'Clima Atlântico', vertical: 'avac' },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Janelas Madeira Demo',
    vertical: 'caixilharia',
  },
] as Organization[];

describe('OrganizationsController', () => {
  beforeEach(() => {
    authState.enabled = false;
  });

  it('returns both allowlisted tenants for the local demo selector', async () => {
    const find = vi.fn().mockResolvedValue(organizations);
    const controller = new OrganizationsController({ find } as unknown as Repository<Organization>);

    const result = await controller.list({});

    expect(result.data).toEqual(organizations);
    expect(find).toHaveBeenCalledOnce();
  });

  it('returns only the authenticated tenant in production mode', async () => {
    authState.enabled = true;
    const find = vi.fn().mockResolvedValue([organizations[1]]);
    const controller = new OrganizationsController({ find } as unknown as Repository<Organization>);

    await controller.list({ user: { orgId: organizations[1].id } as never });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: organizations[1].id } }),
    );
  });
});
