'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatBrl } from '@/lib/api';

type BillingTiming = 'ADVANCE' | 'ARREARS';

type Proposal = {
  id: string;
  number: string;
  status: string;
  billingTiming: BillingTiming;
  customer: { legalName: string };
  branch: { code: string };
  lines: Array<{
    billingPeriod: string;
    unitRate: number;
    description: string;
    equipmentId?: string | null;
  }>;
};

export default function ProposalsPage() {
  const { t } = useLocale();
  const [rows, setRows] = useState<Proposal[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [editTiming, setEditTiming] = useState<BillingTiming>('ADVANCE');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = () =>
    api<Proposal[]>('/proposals')
      .then(setRows)
      .catch(() => setError(t.error));

  useEffect(() => {
    load();
  }, [t.error]);

  const open = async (id: string) => {
    setMessage('');
    try {
      const full = await api<Proposal>(`/proposals/${id}`);
      setSelected(full);
      setEditTiming(full.billingTiming ?? 'ADVANCE');
    } catch {
      setError(t.error);
    }
  };

  const saveTiming = async () => {
    if (!selected) return;
    setBusy('save');
    setMessage('');
    try {
      const updated = await api<Proposal>(`/proposals/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ billingTiming: editTiming }),
      });
      setSelected(updated);
      setMessage(t.saved);
      await load();
    } catch {
      setError(t.error);
    } finally {
      setBusy('');
    }
  };

  const convert = async () => {
    if (!selected) return;
    setBusy('convert');
    setMessage('');
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    try {
      const contract = await api<{ number: string }>(
        `/proposals/${selected.id}/convert`,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            billingTiming: editTiming,
          }),
        },
      );
      setMessage(`${t.proposals.convert}: ${contract.number}`);
      await load();
    } catch {
      setError(t.error);
    } finally {
      setBusy('');
    }
  };

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
            t.proposals.billingTiming,
            t.proposals.status,
          ]}
          empty={t.empty}
          rows={rows.map((p) => [
            <button
              type="button"
              className="linkish"
              key="n"
              onClick={() => open(p.id)}
            >
              {p.number}
            </button>,
            p.customer.legalName,
            p.branch.code,
            p.lines[0]
              ? `${t.status[p.lines[0].billingPeriod as keyof typeof t.status] ?? p.lines[0].billingPeriod} · ${formatBrl(p.lines[0].unitRate)}`
              : '—',
            <span className="badge warn" key="bt">
              {t.status[(p.billingTiming ?? 'ADVANCE') as keyof typeof t.status] ??
                p.billingTiming}
            </span>,
            <span className="badge" key="s">
              {p.status}
            </span>,
          ])}
        />
      </section>

      {selected ? (
        <section className="panel detail-panel" style={{ marginTop: '1rem' }}>
          <div className="detail-head">
            <h2>
              {selected.number} · {selected.customer.legalName}
            </h2>
            <button
              type="button"
              className="ghost"
              onClick={() => setSelected(null)}
            >
              {t.contracts.close}
            </button>
          </div>
          <label className="field">
            <span>{t.proposals.billingTiming}</span>
            <select
              value={editTiming}
              onChange={(e) => setEditTiming(e.target.value as BillingTiming)}
            >
              <option value="ADVANCE">{t.contracts.advance}</option>
              <option value="ARREARS">{t.contracts.arrears}</option>
            </select>
          </label>
          <p className="muted">{t.contracts.billingTimingHelp}</p>
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy === 'save'}
              onClick={saveTiming}
            >
              {t.proposals.saveTiming}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy === 'convert' || !selected.lines.some((l) => l.equipmentId)}
              onClick={convert}
            >
              {t.proposals.convert}
            </button>
          </div>
          {message ? <p className="ok-msg">{message}</p> : null}
        </section>
      ) : null}
    </AppShell>
  );
}
