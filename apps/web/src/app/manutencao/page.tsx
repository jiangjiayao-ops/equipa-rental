'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatDate } from '@/lib/api';

type WorkOrder = {
  id: string;
  title: string;
  status: string;
  dueAt?: string | null;
  equipment: { code: string; branch: { code: string } };
};

export default function MaintenancePage() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<WorkOrder[]>('/maintenance/work-orders')
      .then(setRows)
      .catch(() => setError(t.error));
  }, [t.error]);

  return (
    <AppShell>
      <PageHeader title={t.maintenance.title} subtitle={t.maintenance.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      <section className="panel">
        <DataTable
          headers={[
            t.maintenance.workOrder,
            t.maintenance.equipment,
            t.fleet.branch,
            t.maintenance.due,
            t.maintenance.status,
          ]}
          empty={t.empty}
          rows={rows.map((w) => [
            w.title,
            w.equipment.code,
            w.equipment.branch.code,
            w.dueAt ? formatDate(w.dueAt, locale) : '—',
            <span className="badge" key="s">
              {w.status}
            </span>,
          ])}
        />
      </section>
    </AppShell>
  );
}
