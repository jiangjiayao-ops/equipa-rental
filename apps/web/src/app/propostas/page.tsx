'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatBrl } from '@/lib/api';

type Proposal = {
  id: string;
  number: string;
  status: string;
  customer: { legalName: string };
  branch: { code: string };
  lines: Array<{ billingPeriod: string; unitRate: number; description: string }>;
};

export default function ProposalsPage() {
  const { t } = useLocale();
  const [rows, setRows] = useState<Proposal[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Proposal[]>('/proposals')
      .then(setRows)
      .catch(() => setError(t.error));
  }, [t.error]);

  return (
    <AppShell>
      <PageHeader title={t.proposals.title} subtitle={t.proposals.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      <section className="panel">
        <DataTable
          headers={[
            t.proposals.number,
            t.proposals.customer,
            t.fleet.branch,
            t.proposals.period,
            t.proposals.status,
          ]}
          empty={t.empty}
          rows={rows.map((p) => [
            p.number,
            p.customer.legalName,
            p.branch.code,
            p.lines[0]
              ? `${t.status[p.lines[0].billingPeriod as keyof typeof t.status] ?? p.lines[0].billingPeriod} · ${formatBrl(p.lines[0].unitRate)}`
              : '—',
            <span className="badge" key="s">
              {p.status}
            </span>,
          ])}
        />
      </section>
    </AppShell>
  );
}
