import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authState } = vi.hoisted(() => ({ authState: { enabled: false } }));
vi.mock('@config/auth.config', () => ({ authConfig: authState }));

import type { Repository } from 'typeorm';
import { OrganizationsController } from './organizations.controller';
import type { Organization } from './entities/organization.entity';
import type { OrgBranding } from './entities/org-branding.entity';

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

  it('onboards a persistent demo tenant without requiring a redeploy', async () => {
    const saved = {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'AVAC Porto',
      vertical: 'avac',
      demo_enabled: true,
    } as Organization;
    const repository = {
      create: vi.fn((value) => value),
      save: vi.fn().mockResolvedValue(saved),
    };
    const controller = new OrganizationsController(
      repository as never,
      {} as Repository<OrgBranding>,
    );

    const result = await controller.onboard({ name: 'AVAC Porto', vertical: 'avac' });

    expect(result.data).toEqual({ id: saved.id, name: saved.name, vertical: saved.vertical });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'AVAC Porto', vertical: 'avac', demo_enabled: true }),
    );
  });

  it('gets and patches branding only for the current organization', async () => {
    const branding = {
      org_id: organizations[0].id,
      company_name: 'Clima Atlântico',
      primary_color: '#5eead4',
      iva_rate: 0.23,
      quote_validity_days: 30,
    } as OrgBranding;
    const organizationRepo = { find: vi.fn() };
    const brandingRepo = {
      findOne: vi.fn().mockResolvedValue(branding),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    const controller = new OrganizationsController(
      organizationRepo as never,
      brandingRepo as never,
    );
    const req = { user: { orgId: organizations[0].id } as never };

    expect((await controller.getBranding(req)).data).toEqual(branding);
    const updated = await controller.updateBranding({ iva_rate: 0.2 }, req);

    expect(brandingRepo.findOne).toHaveBeenCalledWith({ where: { org_id: organizations[0].id } });
    expect(brandingRepo.save).toHaveBeenCalledWith(expect.objectContaining({ iva_rate: 0.2 }));
    expect(updated.data.iva_rate).toBe(0.2);
  });

  it('uploads a validated logo to the object store and persists its internal key', async () => {
    const branding = {
      org_id: organizations[0].id,
      company_name: organizations[0].name,
      logo_url: null,
      primary_color: '#5eead4',
      iva_rate: 0.23,
      quote_validity_days: 30,
    } as OrgBranding;
    const brandingRepo = {
      findOne: vi.fn().mockResolvedValue(branding),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    const objectStore = {
      put: vi.fn().mockResolvedValue(`branding/${organizations[0].id}/logo.png`),
    };
    const controller = new OrganizationsController(
      { findOne: vi.fn() } as never,
      brandingRepo as never,
      objectStore as never,
    );
    const file = {
      originalname: 'marca.png',
      mimetype: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    };

    const result = await controller.uploadLogo(file, {
      user: { orgId: organizations[0].id } as never,
    });

    expect(objectStore.put).toHaveBeenCalledWith(
      `branding/${organizations[0].id}/logo.png`,
      file.buffer,
    );
    expect(brandingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ logo_url: `branding/${organizations[0].id}/logo.png` }),
    );
    expect(result.data.logo_url).toBe(`branding/${organizations[0].id}/logo.png`);
  });

  it('streams the current tenant logo from the private object store', async () => {
    const logoUrl = `branding/${organizations[0].id}/logo.png`;
    const bytes = Buffer.from('png-bytes');
    const brandingRepo = {
      findOne: vi.fn().mockResolvedValue({ org_id: organizations[0].id, logo_url: logoUrl }),
    };
    const objectStore = { get: vi.fn().mockResolvedValue(bytes) };
    const controller = new OrganizationsController(
      { findOne: vi.fn() } as never,
      brandingRepo as never,
      objectStore as never,
    );
    const response = {
      setHeader: vi.fn(),
      send: vi.fn(),
    };

    await controller.getLogo({ user: { orgId: organizations[0].id } as never }, response as never);

    expect(objectStore.get).toHaveBeenCalledWith(logoUrl);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', bytes.length);
    expect(response.send).toHaveBeenCalledWith(bytes);
  });

  it('never resolves a persisted logo path that escapes the tenant prefix', async () => {
    const brandingRepo = {
      findOne: vi.fn().mockResolvedValue({
        org_id: organizations[0].id,
        logo_url: `branding/${organizations[0].id}/../${organizations[1].id}/logo.png`,
      }),
    };
    const objectStore = { get: vi.fn() };
    const controller = new OrganizationsController(
      { findOne: vi.fn() } as never,
      brandingRepo as never,
      objectStore as never,
    );

    await expect(
      controller.getLogo({ user: { orgId: organizations[0].id } as never }, {
        setHeader: vi.fn(),
        send: vi.fn(),
      } as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(objectStore.get).not.toHaveBeenCalled();
  });
});
