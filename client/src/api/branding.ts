import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';

/** Org branding (GET/PATCH /organizations/current/branding). `iva_rate` is always 0..1 on the
 * wire; the UI is the only layer that ever renders/edits it as a percentage. */
export interface Branding {
  company_name: string;
  logo_url: string | null;
  primary_color: string | null;
  vat_number: string | null;
  address: string | null;
  footer_text: string | null;
  iva_rate: number;
  email: string | null;
  phone: string | null;
  quote_validity_days: number;
}

export type BrandingWritePayload = Partial<Branding>;

export const brandingKeys = {
  all: () => ['organizations', 'current', 'branding'] as const,
};

export async function fetchBranding(): Promise<Branding> {
  const res = await client.get<{ data: Branding }>('/organizations/current/branding');
  return res.data.data;
}

export function useBranding() {
  return useQuery({ queryKey: brandingKeys.all(), queryFn: fetchBranding });
}

export async function updateBranding(payload: BrandingWritePayload): Promise<Branding> {
  const res = await client.patch<{ data: Branding }>('/organizations/current/branding', payload);
  return res.data.data;
}

export function useUpdateBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBranding,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: brandingKeys.all() }),
  });
}
