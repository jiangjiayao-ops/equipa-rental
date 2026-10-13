import type { Metadata } from 'next';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthGate } from '@/components/AuthGate';
import './globals.css';

export const metadata: Metadata = {
  title: 'Equipa',
  description: 'Industrial equipment rental — Equipa',
};

const themeBootScript = `
(function () {
  try {
    var t = localStorage.getItem('equipa_theme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    document.documentElement.dataset.theme = t;
    document.documentElement.classList.add('theme-' + t);
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.classList.add('theme-dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>
          <LocaleProvider>
            <AuthGate>{children}</AuthGate>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
