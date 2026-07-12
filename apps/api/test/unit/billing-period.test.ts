import { describe, expect, it } from 'vitest';

import { railKeyForMethod } from '@shared/services/billing';

describe('billing/railKeyForMethod — kind → rail key (never a provider name)', () => {
  it('maps each payment-method kind to its rail key', () => {
    expect(railKeyForMethod('card')).toBe('card');
    expect(railKeyForMethod('mandate')).toBe('mandate');
    expect(railKeyForMethod('virtual_account')).toBe('transfer');
  });
});
