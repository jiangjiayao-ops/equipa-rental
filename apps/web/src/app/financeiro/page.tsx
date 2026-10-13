'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatBrl, formatDate } from '@/lib/api';

type Invoice = {
  id: string;
  number: string;
  status: string;
  totalAmount: number;
  dueDate: string;
  issueDate: string;
  billingTiming?: 'ADVANCE' | 'ARREARS' | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  notes?: string | null;
  customer: { legalName: string };
  contract?: {
    number: string;
    billingTiming?: 'ADVANCE' | 'ARREARS';
  } | null;
  payments: Array<{
    method: string;
    amount: number;
    paidAt: string;
    externalRef?: string | null;
  }>;
  fiscalDocs: Array<{
    type: string;
    status: string;
    provider: string;
    providerRef?: string | null;
  }>;
};

export default function FinancePage() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Invoice[]>('/finance/invoices')
      .then(setRows)
      .catch(() => setError(t.error));
  }, [t.error]);

  return (
    <AppShell>
      <PageHeader title={t.finance.title} subtitle={t.finance.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      <div className="stack">
        {rows.length === 0 ? <p className="muted">{t.empty}</p> : null}
        {rows.map((inv) => (
          <section className="panel" key={inv.id}>
            <h2>
              {inv.number}{' '}
              <span className="badge warn">{inv.status}</span>
            </h2>
            <p>
              {inv.customer.legalName}
              {inv.contract ? ` · ${inv.contract.number}` : ''}
            </p>
            {(inv.billingTiming || inv.contract?.billingTiming) ? (
              <p>
                {t.finance.billingTiming}:{' '}
                <span className="badge warn">
                  {t.status[
                    (inv.billingTiming ??
                      inv.contract?.billingTiming) as keyof typeof t.status
                  ] ??
                    inv.billingTiming ??
                    inv.contract?.billingTiming}
                </span>
              </p>
            ) : null}
            <p>
              <strong>{formatBrl(inv.totalAmount)}</strong>
              {' · '}
              {t.finance.issue}: {formatDate(inv.issueDate, locale)}
              {' · '}
              {t.finance.due}: {formatDate(inv.dueDate, locale)}
            </p>
            {inv.periodStart && inv.periodEnd ? (
              <p className="muted">
                {t.finance.period}: {formatDate(inv.periodStart, locale)} →{' '}
                {formatDate(inv.periodEnd, locale)}
              </p>
            ) : null}
            {inv.notes ? <p className="muted">{inv.notes}</p> : null}
            <h3>{t.finance.payments}</h3>
            {inv.payments.length === 0 ? (
              <p className="muted">{t.empty}</p>
            ) : (
              <ul>
                {inv.payments.map((p, i) => (
                  <li key={i}>
                    {p.method}: {formatBrl(p.amount)} ({formatDate(p.paidAt, locale)})
                    {p.externalRef ? ` · ${p.externalRef}` : ''}
                  </li>
                ))}
              </ul>
            )}
            <h3>{t.finance.fiscal}</h3>
            {inv.fiscalDocs.length === 0 ? (
              <p className="muted">{t.empty}</p>
            ) : (
              <ul>
                {inv.fiscalDocs.map((f, i) => (
                  <li key={i}>
                    {f.type} via {f.provider}: {f.status}
                    {f.providerRef ? ` ${f.providerRef}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
