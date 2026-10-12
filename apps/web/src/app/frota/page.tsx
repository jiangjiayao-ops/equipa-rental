'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api } from '@/lib/api';

type Equipment = {
  id: string;
  code: string;
  brand: string;
  model: string;
  hourMeter: number;
  status: string;
  category: { name: string; nameEn?: string | null };
  branch: { code: string; name: string };
};

export default function FleetPage() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Equipment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Equipment[]>('/equipment')
      .then(setRows)
      .catch(() => setError(t.error));
  }, [t.error]);

  return (
    <AppShell>
      <PageHeader title={t.fleet.title} subtitle={t.fleet.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      <section className="panel">
        <DataTable
          headers={[t.fleet.code, t.fleet.type, t.fleet.branch, t.fleet.hours, t.fleet.status]}
          empty={t.empty}
          rows={rows.map((eq) => [
            <strong key="c">{eq.code}</strong>,
            locale === 'en' && eq.category.nameEn ? eq.category.nameEn : eq.category.name,
            `${eq.branch.code} — ${eq.branch.name}`,
            String(eq.hourMeter),
            <span className="badge" key="s">
              {t.status[eq.status as keyof typeof t.status] ?? eq.status}
            </span>,
          ])}
        />
      </section>
    </AppShell>
  );
}
