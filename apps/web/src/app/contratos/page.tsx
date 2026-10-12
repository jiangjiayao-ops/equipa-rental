'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatDate } from '@/lib/api';

type Contract = {
  id: string;
  number: string;
  status: string;
  billingPeriod: string;
  startDate: string;
  endDate: string;
  customer: { legalName: string };
  branch: { code: string };
  lines: Array<{ description: string }>;
  amendments: Array<{ notes?: string | null; type: string }>;
};

export default function ContractsPage() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Contract[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Contract[]>('/contracts')
      .then(setRows)
      .catch(() => setError(t.error));
  }, [t.error]);

  return (
    <AppShell>
      <PageHeader title={t.contracts.title} subtitle={t.contracts.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      <section className="panel">
        <DataTable
          headers={[
            t.contracts.number,
            t.contracts.customer,
            t.fleet.branch,
            t.contracts.period,
            t.contracts.dates,
            t.contracts.status,
            t.contracts.amendments,
          ]}
          empty={t.empty}
          rows={rows.map((c) => [
            <div key="n">
              <strong>{c.number}</strong>
              <div className="muted">{c.lines[0]?.description}</div>
            </div>,
            c.customer.legalName,
            c.branch.code,
            t.status[c.billingPeriod as keyof typeof t.status] ?? c.billingPeriod,
            `${formatDate(c.startDate, locale)} → ${formatDate(c.endDate, locale)}`,
            <span className="badge" key="s">
              {c.status}
            </span>,
            c.amendments[0]?.notes ?? c.amendments[0]?.type ?? '—',
          ])}
        />
      </section>
    </AppShell>
  );
}
