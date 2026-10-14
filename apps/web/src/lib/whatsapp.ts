/** Digits only; adds Brazil 55 when local 10–11 digits. */
export function whatsappDigits(raw?: string | null): string {
  if (!raw) return '';
  let d = raw.replace(/\D/g, '');
  if (d.length >= 10 && d.length <= 11) d = `55${d}`;
  return d;
}

export function proposalWhatsAppText(
  proposalNumber: string,
  locale: 'pt-BR' | 'en',
) {
  return locale === 'en'
    ? `Hello, regarding proposal ${proposalNumber}`
    : `Olá, ref. proposta ${proposalNumber}`;
}

export function whatsappDeepLink(
  number: string | null | undefined,
  proposalNumber: string,
  locale: 'pt-BR' | 'en' = 'pt-BR',
): string | null {
  const digits = whatsappDigits(number);
  if (!digits) return null;
  const text = proposalWhatsAppText(proposalNumber, locale);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
