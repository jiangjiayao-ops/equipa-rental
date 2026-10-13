'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatBrl } from '@/lib/api';

type BillingTiming = 'ADVANCE' | 'ARREARS';
type BillingPeriod = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

type Option = {
  id?: string;
  label: string;
  billingPeriod: BillingPeriod;
  durationDays: number;
  unitRate: number;
  mobFee: number;
  demobFee: number;
};

type Proposal = {
  id: string;
  number: string;
  status: string;
  billingTiming: BillingTiming;
  publicToken?: string | null;
  notes?: string | null;
  validUntil?: string | null;
  customer: { id?: string; legalName: string; email?: string | null; phone?: string | null };
  branch: { id?: string; code: string };
  lines: Array<{
    billingPeriod: string;
    unitRate: number;
    description: string;
    equipmentId?: string | null;
  }>;
  options?: Option[];
  sendAttempts?: Array<{
    id: string;
    channel: string;
    status: string;
    provider: string;
    toAddress?: string | null;
    publicUrl?: string | null;
    error?: string | null;
    createdAt: string;
  }>;
  contracts?: Array<{ id: string; number: string; status: string }>;
  acceptedOption?: Option | null;
};

type Customer = { id: string; legalName: string; email?: string | null; phone?: string | null };
type Branch = { id: string; code: string; name: string };
type Equipment = { id: string; code: string; brand: string; model: string; status: string };

function apiError(err: unknown, fallback: string) {
  if (!(err instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(err.message) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join('; ');
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    /* plain */
  }
  return err.message || fallback;
}

const defaultOptions = (): Option[] => [
  {
    label: '7 days',
    billingPeriod: 'WEEKLY',
    durationDays: 7,
    unitRate: 5000,
    mobFee: 500,
    demobFee: 500,
  },
  {
    label: '30 days',
    billingPeriod: 'MONTHLY',
    durationDays: 30,
    unitRate: 15000,
    mobFee: 500,
    demobFee: 500,
  },
];

export default function ProposalsPage() {
  const { t } = useLocale();
  const [rows, setRows] = useState<Proposal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');
  const [notifyConfig, setNotifyConfig] = useState<{
    email: string;
    whatsapp: string;
  } | null>(null);

  const [form, setForm] = useState({
    customerId: '',
    branchId: '',
    equipmentId: '',
    billingTiming: 'ADVANCE' as BillingTiming,
    validUntil: '',
    notes: '',
    options: defaultOptions(),
  });

  const load = async () => {
    try {
      const [props, cust, br, eq, cfg] = await Promise.all([
        api<Proposal[]>('/proposals'),
        api<Customer[]>('/customers'),
        api<Branch[]>('/branches'),
        api<Equipment[]>('/equipment'),
        api<{ email: string; whatsapp: string }>('/proposals/notify-config').catch(
          () => ({ email: 'not_configured', whatsapp: 'not_configured' }),
        ),
      ]);
      setRows(props);
      setCustomers(cust);
      setBranches(br);
      setEquipment(eq);
      setNotifyConfig(cfg);
      setForm((prev) => ({
        ...prev,
        customerId: prev.customerId || cust[0]?.id || '',
        branchId: prev.branchId || br[0]?.id || '',
        equipmentId: prev.equipmentId || eq[0]?.id || '',
      }));
    } catch (err) {
      setError(apiError(err, t.error));
    }
  };

  useEffect(() => {
    load();
  }, [t.error]);

  const open = async (id: string) => {
    setMessage('');
    setPublicUrl('');
    try {
      const full = await api<Proposal>(`/proposals/${id}`);
      setSelected(full);
      if (full.publicToken) {
        setPublicUrl(
          `${window.location.origin}/p/${full.publicToken}`,
        );
      }
    } catch (err) {
      setError(apiError(err, t.error));
    }
  };

  const createProposal = async () => {
    setBusy('create');
    setError('');
    setMessage('');
    try {
      const created = await api<Proposal>('/proposals', {
        method: 'POST',
        body: JSON.stringify({
          customerId: form.customerId,
          branchId: form.branchId,
          billingTiming: form.billingTiming,
          validUntil: form.validUntil || undefined,
          notes: form.notes || undefined,
          lines: [{ equipmentId: form.equipmentId }],
          options: form.options.map((o, i) => ({
            label: o.label,
            billingPeriod: o.billingPeriod,
            durationDays: Number(o.durationDays),
            unitRate: Number(o.unitRate),
            mobFee: Number(o.mobFee) || 0,
            demobFee: Number(o.demobFee) || 0,
            sortOrder: i,
          })),
        }),
      });
      setShowCreate(false);
      setMessage(`${t.proposals.create}: ${created.number}`);
      await load();
      await open(created.id);
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy('');
    }
  };

  const sendProposal = async () => {
    if (!selected) return;
    setBusy('send');
    setError('');
    setMessage('');
    try {
      const res = await api<{
        proposal: Proposal;
        publicUrl: string;
        notifyConfig: { email: string; whatsapp: string };
        attempts: Proposal['sendAttempts'];
      }>(`/proposals/${selected.id}/send`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSelected(res.proposal);
      setPublicUrl(res.publicUrl);
      setNotifyConfig(res.notifyConfig);
      const modes = (res.attempts ?? [])
        .map((a) => `${a.channel}:${a.status}`)
        .join(', ');
      setMessage(`${t.proposals.send}: ${modes}`);
      await load();
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy('');
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setMessage(t.proposals.copyLink);
  };

  return (
    <AppShell>
      <PageHeader title={t.proposals.title} subtitle={t.proposals.subtitle} />
      <p className="muted" style={{ marginTop: '-0.6rem' }}>
        {t.proposals.demoHint}
      </p>
      {error ? <p className="error-msg">{error}</p> : null}
      {message ? <p className="ok-msg">{message}</p> : null}

      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="primary"
          onClick={() => {
            setShowCreate((v) => !v);
            setError('');
          }}
        >
          {showCreate ? t.proposals.cancel : t.proposals.newProposal}
        </button>
      </div>

      {showCreate ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{t.proposals.newProposal}</h2>
          <div className="form-grid">
            <label className="field">
              <span>{t.proposals.customer}</span>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legalName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.fleet.branch}</span>
              <select
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.proposals.equipment}</span>
              <select
                value={form.equipmentId}
                onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
              >
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.code} · {eq.brand} {eq.model}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.proposals.billingTiming}</span>
              <select
                value={form.billingTiming}
                onChange={(e) =>
                  setForm({
                    ...form,
                    billingTiming: e.target.value as BillingTiming,
                  })
                }
              >
                <option value="ADVANCE">{t.contracts.advance}</option>
                <option value="ARREARS">{t.contracts.arrears}</option>
              </select>
            </label>
            <label className="field">
              <span>{t.proposals.validity}</span>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t.proposals.notes}</span>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>

          <h3 style={{ marginTop: '1rem' }}>{t.proposals.options}</h3>
          {form.options.map((opt, idx) => (
            <div className="form-grid" key={idx} style={{ marginBottom: '0.5rem' }}>
              <label className="field">
                <span>{t.proposals.optionLabel}</span>
                <input
                  value={opt.label}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[idx] = { ...opt, label: e.target.value };
                    setForm({ ...form, options });
                  }}
                />
              </label>
              <label className="field">
                <span>{t.proposals.period}</span>
                <select
                  value={opt.billingPeriod}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[idx] = {
                      ...opt,
                      billingPeriod: e.target.value as BillingPeriod,
                    };
                    setForm({ ...form, options });
                  }}
                >
                  <option value="WEEKLY">{t.status.WEEKLY}</option>
                  <option value="MONTHLY">{t.status.MONTHLY}</option>
                  <option value="YEARLY">{t.status.YEARLY}</option>
                </select>
              </label>
              <label className="field">
                <span>{t.proposals.durationDays}</span>
                <input
                  type="number"
                  min={1}
                  value={opt.durationDays}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[idx] = {
                      ...opt,
                      durationDays: Number(e.target.value),
                    };
                    setForm({ ...form, options });
                  }}
                />
              </label>
              <label className="field">
                <span>{t.proposals.unitRate}</span>
                <input
                  type="number"
                  min={0}
                  value={opt.unitRate}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[idx] = { ...opt, unitRate: Number(e.target.value) };
                    setForm({ ...form, options });
                  }}
                />
              </label>
              <label className="field">
                <span>{t.proposals.mobFee}</span>
                <input
                  type="number"
                  min={0}
                  value={opt.mobFee}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[idx] = { ...opt, mobFee: Number(e.target.value) };
                    setForm({ ...form, options });
                  }}
                />
              </label>
              <label className="field">
                <span>{t.proposals.demobFee}</span>
                <input
                  type="number"
                  min={0}
                  value={opt.demobFee}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[idx] = { ...opt, demobFee: Number(e.target.value) };
                    setForm({ ...form, options });
                  }}
                />
              </label>
            </div>
          ))}
          <div className="actions">
            <button
              type="button"
              className="ghost"
              onClick={() =>
                setForm({
                  ...form,
                  options: [
                    ...form.options,
                    {
                      label: 'Yearly',
                      billingPeriod: 'YEARLY',
                      durationDays: 365,
                      unitRate: 120000,
                      mobFee: 1000,
                      demobFee: 1000,
                    },
                  ],
                })
              }
            >
              {t.proposals.addOption}
            </button>
            {form.options.length > 1 ? (
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  setForm({
                    ...form,
                    options: form.options.slice(0, -1),
                  })
                }
              >
                {t.proposals.removeOption}
              </button>
            ) : null}
            <button
              type="button"
              className="primary"
              disabled={busy === 'create'}
              onClick={createProposal}
            >
              {t.proposals.create}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <DataTable
          headers={[
            t.proposals.number,
            t.proposals.customer,
            t.fleet.branch,
            t.proposals.options,
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
            p.options?.length
              ? p.options.map((o) => o.label).join(', ')
              : p.lines[0]
                ? t.status[p.lines[0].billingPeriod as keyof typeof t.status] ??
                  p.lines[0].billingPeriod
                : '—',
            t.status[(p.billingTiming ?? 'ADVANCE') as keyof typeof t.status] ??
              p.billingTiming,
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
              {t.proposals.close}
            </button>
          </div>
          <p>
            <span className="badge">{selected.status}</span>
            {' · '}
            {t.status[selected.billingTiming as keyof typeof t.status]}
          </p>
          <p className="muted">{t.proposals.sendHelp}</p>
          {notifyConfig ? (
            <p className="muted">
              Email: {notifyConfig.email} · WhatsApp: {notifyConfig.whatsapp}
            </p>
          ) : null}

          <h3>{t.proposals.options}</h3>
          <ul>
            {(selected.options ?? []).map((o) => (
              <li key={o.id ?? o.label}>
                <strong>{o.label}</strong> — {o.durationDays}d ·{' '}
                {t.status[o.billingPeriod as keyof typeof t.status]} ·{' '}
                {formatBrl(o.unitRate)}
                {o.mobFee ? ` · mob ${formatBrl(o.mobFee)}` : ''}
              </li>
            ))}
          </ul>

          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy === 'send' || selected.status === 'ACCEPTED'}
              onClick={sendProposal}
            >
              {t.proposals.send}
            </button>
            {publicUrl ? (
              <button type="button" className="ghost" onClick={copyLink}>
                {t.proposals.copyLink}
              </button>
            ) : null}
          </div>

          {publicUrl ? (
            <p style={{ marginTop: '0.75rem' }}>
              <strong>{t.proposals.publicLink}:</strong>{' '}
              <a href={publicUrl} target="_blank" rel="noreferrer">
                {publicUrl}
              </a>
            </p>
          ) : null}

          <h3 style={{ marginTop: '1rem' }}>{t.proposals.sendAttempts}</h3>
          {(selected.sendAttempts ?? []).length === 0 ? (
            <p className="muted">{t.empty}</p>
          ) : (
            <ul>
              {(selected.sendAttempts ?? []).map((a) => (
                <li key={a.id}>
                  {a.channel} · {a.status} · {a.provider}
                  {a.toAddress ? ` · ${a.toAddress}` : ''}
                  {a.status === 'DEV_OUTBOX'
                    ? ` — ${t.proposals.notifyNotConfigured}`
                    : a.status === 'SENT'
                      ? ` — ${t.proposals.notifySent}`
                      : ''}
                  {a.error ? ` · ${a.error}` : ''}
                </li>
              ))}
            </ul>
          )}

          {(selected.contracts ?? []).length ? (
            <>
              <h3>{t.proposals.contract}</h3>
              <ul>
                {selected.contracts!.map((c) => (
                  <li key={c.id}>
                    {c.number} · {c.status}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}
