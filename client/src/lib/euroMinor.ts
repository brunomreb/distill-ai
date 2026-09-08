/** Converts a euro amount (as edited in the admin UI) to integer minor units (cents) for the wire. */
export function eurosToMinor(euros: number): number {
  return Math.round(euros * 100);
}

/** Converts integer minor units (cents) from the wire to a euro amount for the admin UI. */
export function minorToEuros(minor: number): number {
  return minor / 100;
}

/** Converts a 0..1 rate (IVA as the API sends/expects it) to a whole percentage for the UI. */
export function rateToPercent(rate: number): number {
  return rate * 100;
}

/** Converts a whole percentage (as edited in the admin UI) back to a 0..1 rate for the API. */
export function percentToRate(percent: number): number {
  return percent / 100;
}
