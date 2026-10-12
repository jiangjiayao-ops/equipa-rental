'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { useLocale } from '@/i18n/LocaleProvider';
import { setToken } from '@/lib/api';

const links = [
  { href: '/', key: 'today' as const },
  { href: '/frota', key: 'fleet' as const },
  { href: '/agenda', key: 'calendar' as const },
  { href: '/clientes', key: 'customers' as const },
  { href: '/propostas', key: 'proposals' as const },
  { href: '/contratos', key: 'contracts' as const },
  { href: '/operacoes', key: 'operations' as const },
  { href: '/financeiro', key: 'finance' as const },
  { href: '/manutencao', key: 'maintenance' as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  function logout() {
    setToken(null);
    router.replace('/login');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand">{t.brand}</div>
          <p className="tagline">{t.tagline}</p>
        </div>
        <nav>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'nav-link active' : 'nav-link'}
            >
              {t.nav[link.key]}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <LanguageSwitcher />
          <button type="button" className="ghost" onClick={logout}>
            {t.logout}
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
