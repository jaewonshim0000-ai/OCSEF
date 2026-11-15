import { describe, expect, it } from 'vitest';
import { formatPhone } from '../lib/phone';

describe('formatPhone', () => {
  it('spaces a bare 10-digit number as 3-3-4', () => {
    expect(formatPhone('2025550123')).toBe('202 555 0123');
  });

  it('spaces a bare 11-digit number starting with 0 as 5-6', () => {
    expect(formatPhone('07700900123')).toBe('07700 900123');
  });

  it('leaves numbers typed with spaces, dashes or + as typed', () => {
    expect(formatPhone('07700 900123')).toBe('07700 900123');
    expect(formatPhone('202-555-0123')).toBe('202-555-0123');
    expect(formatPhone('+447700900123')).toBe('+447700900123');
    expect(formatPhone(' 999 ')).toBe('999');
  });
});
