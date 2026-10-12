'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatDate } from '@/lib/api';

type Block = {
  id: string;
  reason: string;
  startDate: string;
  endDate: string;
  equipment: { code: string };
  branch: { code: string };
};

export default function AgendaPage() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Block[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Block[]>('/calendar')
      .then(setRows)
      .catch(() => setError(t.error));
  }, [t.error]);

  return (
    <AppShell>
      <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      <section className="panel">
        <DataTable
          headers={[t.calendar.equipment, t.fleet.branch, t.calendar.period, t.calendar.reason]}
          empty={t.empty}
          rows={rows.map((b) => [
            b.equipment.code,
            b.branch.code,
            `${formatDate(b.startDate, locale)} → ${formatDate(b.endDate, locale)}`,
            b.reason,
          ])}
        />
      </section>
    </AppShell>
  );
}
