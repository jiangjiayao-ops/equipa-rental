/** Digits only */
export function digitsOnly(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/** CNPJ: 00.000.000/0000-00 */
export function formatCnpj(value: string): string {
  const d = digitsOnly(value).slice(0, 14);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `/${p4}`;
  if (p5) out += `-${p5}`;
  return out;
}

/** CEP: 00000-000 */
export function formatCep(value: string): string {
  const d = digitsOnly(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * BR phone:
 * 10 digits → (11) 3456-7890
 * 11 digits → (11) 98765-4321
 * Also accepts leading 55 country code (stripped for display).
 */
export function formatPhoneBr(value: string): string {
  let d = digitsOnly(value);
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const area = d.slice(0, 2);
  const rest = d.slice(2);
  if (d.length <= 6) return `(${area}) ${rest}`;
  if (d.length <= 10) {
    return `(${area}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `(${area}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/** Canonical stored forms (keep punctuation — matches existing seed/API data). */
export function storeCnpj(value: string | null | undefined): string | null {
  if (value == null || !digitsOnly(value)) return null;
  const d = digitsOnly(value);
  if (d.length !== 14) return formatCnpj(value) || null;
  return formatCnpj(d);
}

export function storeCep(value: string | null | undefined): string | null {
  if (value == null || !digitsOnly(value)) return null;
  return formatCep(value) || null;
}

export function storePhone(value: string | null | undefined): string | null {
  if (value == null || !digitsOnly(value)) return null;
  return formatPhoneBr(value) || null;
}
