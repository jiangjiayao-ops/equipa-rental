'use client';

import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from './ThemeProvider';

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();

  return (
    <div
      className={`theme-switch${compact ? ' compact' : ''}`}
      aria-label={t.theme}
      title={t.theme}
    >
      <button
        type="button"
        className={theme === 'light' ? 'active' : ''}
        onClick={() => setTheme('light')}
      >
        {t.themeLight}
      </button>
      <span className="sep">|</span>
      <button
        type="button"
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => setTheme('dark')}
      >
        {t.themeDark}
      </button>
    </div>
  );
}
