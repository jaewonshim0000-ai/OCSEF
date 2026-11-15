/**
 * Spaces a bare run of digits so a phone number is easier to read at large
 * text sizes. Numbers typed with spaces, dashes or + are shown as typed.
 */
// ponytail: covers 10-digit (North American) and 0-prefixed 11-digit (UK) numbers only; others show as typed.
export function formatPhone(phone: string): string {
  const p = phone.trim();
  if (/^\d{10}$/.test(p)) return `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`;
  if (/^0\d{10}$/.test(p)) return `${p.slice(0, 5)} ${p.slice(5)}`;
  return p;
}
