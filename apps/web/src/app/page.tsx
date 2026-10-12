'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatBrl, formatDate } from '@/lib/api';

type Today = {
  fleet: {
    total: number;
    available: number;
    onRent: number;
    byStatus: Record<string, number>;
  };
  branches: Array<{
    code: string;
    name: string;
    equipmentCount: number;
  }>;
  activeContracts: number;
  overdueInvoices: Array<{
    number: string;
    totalAmount: number;
    dueDate: string;
    status: string;
    customer: { legalName: string };
  }>;
  mobilizations: Array<{
    type: string;
    status: string;
    scheduledAt: string;
    equipment: { code: string };
  }>;
  maintenanceDue: Array<{
    title: string;
    status: string;
    dueAt?: string;
    equipment: { code: string };
  }>;
};

export default function TodayPage() {
  const { t, locale } = useLocale();
  const [data, setData] = useState<Today | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Today>('/dashboard/today')
      .then(setData)
      .catch(() => setError(t.error));
  }, [t.error]);

  return (
    <AppShell>
      <PageHeader title={t.today.title} subtitle={t.today.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      {!data ? (
        <p className="muted">{t.loading}</p>
      ) : (
        <div className="stack">
          <div className="grid-stats">
            <div className="stat">
              <span>{t.today.fleetTotal}</span>
              <strong>{data.fleet.total}</strong>
            </div>
            <div className="stat">
              <span>{t.today.available}</span>
              <strong>{data.fleet.available}</strong>
            </div>
            <div className="stat">
              <span>{t.today.onRent}</span>
              <strong>{data.fleet.onRent}</strong>
            </div>
            <div className="stat">
              <span>{t.today.activeContracts}</span>
              <strong>{data.activeContracts}</strong>
            </div>
          </div>

          <div className="split">
            <section className="panel">
              <h2>{t.today.branches}</h2>
              <ul>
                {data.branches.map((b) => (
                  <li key={b.code}>
                    <strong>{b.code}</strong>: {b.name} ({b.equipmentCount})
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h2>{t.today.overdue}</h2>
              {data.overdueInvoices.length === 0 ? (
                <p className="muted">{t.empty}</p>
              ) : (
                <ul>
                  {data.overdueInvoices.map((inv) => (
                    <li key={inv.number}>
                      <strong>{inv.number}</strong> — {inv.customer.legalName}
                      <br />
                      {formatBrl(inv.totalAmount)} · {formatDate(inv.dueDate, locale)} ·{' '}
                      <span className="badge danger">{inv.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="split">
            <section className="panel">
              <h2>{t.today.mobilizations}</h2>
              {data.mobilizations.length === 0 ? (
                <p className="muted">{t.empty}</p>
              ) : (
                <ul>
                  {data.mobilizations.map((m, i) => (
                    <li key={i}>
                      {m.equipment.code} · {m.type} ·{' '}
                      <span className="badge warn">{m.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <h2>{t.today.maintenanceDue}</h2>
              {data.maintenanceDue.length === 0 ? (
                <p className="muted">{t.empty}</p>
              ) : (
                <ul>
                  {data.maintenanceDue.map((w, i) => (
                    <li key={i}>
                      {w.equipment.code} — {w.title}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
