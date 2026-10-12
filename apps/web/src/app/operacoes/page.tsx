'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatDate } from '@/lib/api';

type Mob = {
  id: string;
  type: string;
  status: string;
  scheduledAt: string;
  carrier?: string | null;
  equipment: { code: string };
  branch: { code: string };
  contract: { number: string };
};

export default function OperationsPage() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Mob[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Mob[]>('/operations/mobilizations')
      .then(setRows)
      .catch(() => setError(t.error));
  }, [t.error]);

  return (
    <AppShell>
      <PageHeader title={t.operations.title} subtitle={t.operations.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      <section className="panel">
        <DataTable
          headers={[
            t.operations.equipment,
            t.operations.type,
            t.fleet.branch,
            t.operations.scheduled,
            t.operations.status,
          ]}
          empty={t.empty}
          rows={rows.map((m) => [
            `${m.equipment.code} · ${m.contract.number}`,
            m.type,
            m.branch.code,
            formatDate(m.scheduledAt, locale),
            <span className="badge warn" key="s">
              {m.status}
            </span>,
          ])}
        />
      </section>
    </AppShell>
  );
}
