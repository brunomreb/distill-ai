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
  /** Nests under all() (prefix match) so invalidating the branding query after a save or a logo
   * upload also invalidates this one — no separate invalidation call needed at the call site. */
  logo: (cacheBust = 0) => [...brandingKeys.all(), 'logo', cacheBust] as const,
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

export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg'];

/** Client-side guard so an obviously-invalid file never reaches the network. The server is the
 * real authority on both constraints; this only exists to fail fast with a readable message. */
export function validateLogoFile(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return 'O logótipo tem de ser um ficheiro PNG ou JPEG.';
  }
  if (file.size > MAX_LOGO_BYTES) {
    return 'O logótipo não pode exceder 2 MB.';
  }
  return null;
}

export async function uploadBrandingLogo(file: File): Promise<Branding> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post<{ data: Branding }>('/organizations/current/branding/logo', form);
  return res.data.data;
}

export function useUploadBrandingLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadBrandingLogo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: brandingKeys.all() }),
  });
}

/** logo_url is a private internal object-store key, never a browsable URL — the logo can only be
 * fetched through this authenticated endpoint, as a blob the UI turns into an object URL. */
export async function fetchBrandingLogo(cacheBust?: number): Promise<Blob> {
  const res = await client.get<Blob>('/organizations/current/branding/logo', {
    responseType: 'blob',
    params: cacheBust ? { v: cacheBust } : undefined,
  });
  return res.data;
}

/** `cacheBust` changes the query key (and the request URL) so a post-upload refetch is a real,
 * distinct network request rather than one an intermediate HTTP cache could shortcut. */
export function useBrandingLogo(options: { enabled: boolean; cacheBust?: number }) {
  const cacheBust = options.cacheBust ?? 0;
  return useQuery({
    queryKey: brandingKeys.logo(cacheBust),
    queryFn: () => fetchBrandingLogo(cacheBust),
    enabled: options.enabled,
  });
}
