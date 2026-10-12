'use client';

import { useLocale } from './LocaleProvider';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={`lang-switch${compact ? ' compact' : ''}`} aria-label={t.language}>
      <button
        type="button"
        className={locale === 'pt-BR' ? 'active' : ''}
        onClick={() => setLocale('pt-BR')}
      >
        PT
      </button>
      <span className="sep">|</span>
      <button
        type="button"
        className={locale === 'en' ? 'active' : ''}
        onClick={() => setLocale('en')}
      >
        EN
      </button>
    </div>
  );
}
