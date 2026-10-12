'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api } from '@/lib/api';

type Customer = {
  id: string;
  legalName: string;
  document: string;
  city?: string | null;
  state?: string | null;
  _count: { contracts: number; proposals: number };
};

export default function CustomersPage() {
  const { t } = useLocale();
  const [rows, setRows] = useState<Customer[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Customer[]>('/customers')
      .then(setRows)
      .catch(() => setError(t.error));
  }, [t.error]);

  return (
    <AppShell>
      <PageHeader title={t.customers.title} subtitle={t.customers.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      <section className="panel">
        <DataTable
          headers={[t.proposals.customer, t.customers.document, t.customers.city, t.customers.contracts]}
          empty={t.empty}
          rows={rows.map((c) => [
            c.legalName,
            c.document,
            [c.city, c.state].filter(Boolean).join(' / ') || '—',
            String(c._count.contracts),
          ])}
        />
      </section>
    </AppShell>
  );
}
