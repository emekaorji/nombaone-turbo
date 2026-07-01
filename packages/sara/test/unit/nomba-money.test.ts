import { describe, expect, it } from 'vitest';

import { koboToNombaAmount, nombaAmountToKobo } from '@nombaone/sara/nomba';

/**
 * The Nomba money boundary (D.1). Our engine is integer kobo; Nomba is naira decimals.
 * Getting this wrong is a 100× charge — so it's pinned hard.
 */
describe('nomba money boundary', () => {
  it('koboToNombaAmount: integer kobo → naira decimal string (÷100, 2dp)', () => {
    expect(koboToNombaAmount(100)).toBe('1.00'); // ₦1.00
    expect(koboToNombaAmount(250000)).toBe('2500.00'); // ₦2,500
    expect(koboToNombaAmount(500000)).toBe('5000.00'); // ₦5,000
    expect(koboToNombaAmount(1)).toBe('0.01'); // 1 kobo
    expect(koboToNombaAmount(5050)).toBe('50.50'); // ₦50.50
    expect(koboToNombaAmount(0)).toBe('0.00');
  });

  it('nombaAmountToKobo: naira (string or number) → integer kobo (×100, rounded)', () => {
    expect(nombaAmountToKobo('100.0')).toBe(10000); // the live requery shape
    expect(nombaAmountToKobo('5000.00')).toBe(500000);
    expect(nombaAmountToKobo('0.01')).toBe(1);
    expect(nombaAmountToKobo(2500)).toBe(250000);
    expect(nombaAmountToKobo('50.50')).toBe(5050);
    expect(nombaAmountToKobo(null)).toBe(0);
    expect(nombaAmountToKobo(undefined)).toBe(0);
    expect(nombaAmountToKobo('nonsense')).toBe(0);
  });

  it('round-trips within a kobo (no float drift on the money path)', () => {
    for (const kobo of [1, 99, 100, 5050, 250000, 999999, 123456789]) {
      expect(nombaAmountToKobo(koboToNombaAmount(kobo))).toBe(kobo);
    }
  });
});
