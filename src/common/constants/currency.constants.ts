/** Stratos prices and quotes are denominated exclusively in euros. */
export const STRATOS_CURRENCY = 'EUR' as const;

export function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export function isEuroCurrency(value: string): boolean {
  return normalizeCurrency(value) === STRATOS_CURRENCY;
}
