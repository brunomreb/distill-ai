import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  useBranding,
  useBrandingLogo,
  useUpdateBranding,
  useUploadBrandingLogo,
  validateLogoFile,
} from '../../api/branding';
import type { Branding, BrandingWritePayload } from '../../api/branding';
import { ErrorBanner } from '../inbox/ErrorBanner';
import { rateToPercent, percentToRate } from '../../lib/euroMinor';
import { GENERIC_ERROR } from '../../lib/errorMessages';

interface LogoUploaderProps {
  hasLogo: boolean;
}

/** Logo is its own upload endpoint, decoupled from the rest of the form's "edit then Guardar"
 * flow: it uploads (and shows its own pending/error state) the instant a valid file is picked,
 * with no free-text field for the URL — logo_url stays a persisted, server-owned key. The image
 * itself is never rendered from that key (it's a private object-store path, not a browsable URL):
 * it's fetched as a blob through the authenticated endpoint and shown via an object URL. */
function LogoUploader({ hasLogo }: LogoUploaderProps) {
  const mutation = useUploadBrandingLogo();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);
  const logoQuery = useBrandingLogo({ enabled: hasLogo, cacheBust });
  // Object URLs are a pure function of the blob, so it's computed directly in render rather than
  // stored via an effect + setState (which would cost an extra render); the effect below only
  // handles the one real side effect, revoking the previous URL once it's no longer displayed.
  const objectUrl = useMemo(
    () => (logoQuery.data ? URL.createObjectURL(logoQuery.data) : null),
    [logoQuery.data],
  );

  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const error = validateLogoFile(file);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    // A distinct query key (and request URL) is needed on top of the query-cache invalidation the
    // upload mutation already does, so the refetch can't be served by an intermediate HTTP cache.
    mutation.mutate(file, { onSuccess: () => setCacheBust((n) => n + 1) });
  }

  const errorMessage = validationError ?? (mutation.isError ? GENERIC_ERROR : null);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted">Logótipo</span>
      <div className="flex items-center gap-3">
        {objectUrl ? (
          <img
            src={objectUrl}
            alt="Logótipo da organização"
            className="h-12 w-12 rounded-lg border border-border bg-canvas object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border text-center text-[10px] text-muted">
            Sem logo
          </div>
        )}
        <label className="flex h-9 cursor-pointer items-center rounded-button border border-border px-3 text-sm font-medium text-body-text hover:bg-canvas">
          {mutation.isPending ? 'A carregar…' : 'Carregar logótipo'}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileChange}
            disabled={mutation.isPending}
            className="sr-only"
            aria-label="Carregar logótipo"
          />
        </label>
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-error-tx">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

const inputClass =
  'h-9 rounded-lg border border-border bg-canvas px-3 text-sm text-body-text placeholder:text-muted focus:border-accent focus:outline-none';

function nullableText(value: string): string | null {
  return value.trim().length > 0 ? value.trim() : null;
}

interface BrandingFormProps {
  initial: Branding;
  onSubmit: (payload: BrandingWritePayload) => void;
  isPending: boolean;
  error: string | null;
}

function BrandingForm({ initial, onSubmit, isPending, error }: BrandingFormProps) {
  const [companyName, setCompanyName] = useState(initial.company_name);
  const [primaryColor, setPrimaryColor] = useState(initial.primary_color ?? '');
  const [vatNumber, setVatNumber] = useState(initial.vat_number ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [footerText, setFooterText] = useState(initial.footer_text ?? '');
  const [ivaPercent, setIvaPercent] = useState(String(rateToPercent(initial.iva_rate)));
  const [email, setEmail] = useState(initial.email ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [validityDays, setValidityDays] = useState(String(initial.quote_validity_days));
  const [validationError, setValidationError] = useState<string | null>(null);

  const canSubmit = companyName.trim().length > 0 && ivaPercent.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const ivaValue = Number(ivaPercent);
    if (!Number.isFinite(ivaValue) || ivaValue < 0) {
      setValidationError('IVA inválido.');
      return;
    }
    const validityValue = Number(validityDays);
    if (!Number.isFinite(validityValue) || validityValue < 0) {
      setValidationError('Validade do orçamento inválida.');
      return;
    }

    onSubmit({
      company_name: companyName.trim(),
      primary_color: nullableText(primaryColor),
      vat_number: nullableText(vatNumber),
      address: nullableText(address),
      footer_text: nullableText(footerText),
      iva_rate: percentToRate(ivaValue),
      email: nullableText(email),
      phone: nullableText(phone),
      quote_validity_days: validityValue,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3">
      {(validationError ?? error) && (
        <p role="alert" className="text-sm text-error-tx">
          {validationError ?? error}
        </p>
      )}

      <Field label="Nome da empresa">
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cor primária">
          <input
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#5eead4"
            className={inputClass}
          />
        </Field>
        <Field label="NIF">
          <input
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Morada">
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-body-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </Field>
      <Field label="Rodapé do orçamento">
        <textarea
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          rows={2}
          className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-body-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="IVA (%)">
          <input
            type="number"
            step="0.1"
            min="0"
            value={ivaPercent}
            onChange={(e) => setIvaPercent(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Telefone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Validade do orçamento (dias)">
        <input
          type="number"
          min="0"
          value={validityDays}
          onChange={(e) => setValidityDays(e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit || isPending}
          className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-brand-ink hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

export function BrandingPanel() {
  const { data: branding, isLoading, isError, refetch } = useBranding();
  const mutation = useUpdateBranding();

  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
        A carregar branding…
      </div>
    );
  }

  if (isError || !branding) {
    return (
      <ErrorBanner message="Não foi possível carregar o branding." onRetry={() => void refetch()} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-slate-900">Branding</h2>
      <LogoUploader hasLogo={Boolean(branding.logo_url)} />
      <BrandingForm
        initial={branding}
        onSubmit={(payload) => mutation.mutate(payload)}
        isPending={mutation.isPending}
        error={mutation.isError ? GENERIC_ERROR : null}
      />
    </div>
  );
}
