import { eurosToMinor, minorToEuros, rateToPercent, percentToRate } from './euroMinor';

describe('eurosToMinor', () => {
  it('converts a euro amount to integer cents', () => {
    expect(eurosToMinor(900)).toBe(90000);
  });

  it('rounds fractional cents from floating-point input', () => {
    expect(eurosToMinor(19.99)).toBe(1999);
  });

  it('converts zero to zero', () => {
    expect(eurosToMinor(0)).toBe(0);
  });
});

describe('minorToEuros', () => {
  it('converts integer cents back to euros', () => {
    expect(minorToEuros(90000)).toBe(900);
  });

  it('keeps two decimal places for odd cent amounts', () => {
    expect(minorToEuros(1999)).toBeCloseTo(19.99, 2);
  });
});

describe('rateToPercent', () => {
  it('converts a 0..1 rate to a whole percentage for display', () => {
    expect(rateToPercent(0.23)).toBeCloseTo(23, 5);
  });

  it('converts a reduced rate', () => {
    expect(rateToPercent(0.06)).toBeCloseTo(6, 5);
  });
});

describe('percentToRate', () => {
  it('converts a whole percentage back to a 0..1 rate for the API', () => {
    expect(percentToRate(23)).toBeCloseTo(0.23, 5);
  });

  it('converts a reduced percentage', () => {
    expect(percentToRate(6)).toBeCloseTo(0.06, 5);
  });
});
