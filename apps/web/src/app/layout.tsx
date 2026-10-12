import type { Metadata } from 'next';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { AuthGate } from '@/components/AuthGate';
import './globals.css';

export const metadata: Metadata = {
  title: 'Equipa',
  description: 'Industrial equipment rental — Equipa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <LocaleProvider>
          <AuthGate>{children}</AuthGate>
        </LocaleProvider>
      </body>
    </html>
  );
}
