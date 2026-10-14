'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, formatDate, isMasterAdmin } from '@/lib/api';

type BillingTiming = 'ADVANCE' | 'ARREARS';

type Contract = {
  id: string;
  number: string;
  status: string;
  billingPeriod: string;
  billingTiming: BillingTiming;
  startDate: string;
  endDate: string;
  notes?: string | null;
  customer: { legalName: string };
  branch: { code: string };
  lines: Array<{ description: string; unitRate: number }>;
  amendments: Array<{ notes?: string | null; type: string }>;
  invoices?: Array<{ id: string; number: string }>;
};

type Customer = { id: string; legalName: string };
type Branch = { id: string; code: string; name: string };
type Equipment = {
  id: string;
  code: string;
  brand: string;
  model: string;
  status: string;
};

function timingLabel(
  timing: BillingTiming,
  t: {
    status: Record<string, string>;
    contracts: { advance: string; arrears: string };
  },
) {
  if (timing === 'ARREARS') {
    return t.status.ARREARS ?? t.contracts.arrears;
  }
  return t.status.ADVANCE ?? t.contracts.advance;
}

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

export default function ContractsPage() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Contract | null>(null);
  const [editTiming, setEditTiming] = useState<BillingTiming>('ADVANCE');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [master, setMaster] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hardDelete, setHardDelete] = useState(false);

  const [createForm, setCreateForm] = useState({
    customerId: '',
    branchId: '',
    equipmentId: '',
    billingPeriod: 'MONTHLY',
    billingTiming: 'ADVANCE' as BillingTiming,
    unitRate: '1000',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });

  const load = () =>
    api<Contract[]>('/contracts')
      .then(setRows)
      .catch(() => setError(t.error));

  useEffect(() => {
    setMaster(isMasterAdmin());
    load();
    Promise.all([
      api<Customer[]>('/customers'),
      api<Branch[]>('/branches'),
      api<Equipment[]>('/equipment'),
    ])
      .then(([c, b, e]) => {
        setCustomers(c);
        setBranches(b);
        setEquipment(e);
        setCreateForm((prev) => ({
          ...prev,
          customerId: prev.customerId || c[0]?.id || '',
          branchId: prev.branchId || b[0]?.id || '',
          equipmentId: prev.equipmentId || e[0]?.id || '',
        }));
      })
      .catch(() => undefined);
  }, [t.error]);

  const open = async (id: string) => {
    setMessage('');
    setShowCreate(false);
    setBusy('load');
    try {
      const full = await api<Contract>(`/contracts/${id}`);
      setSelected(full);
      setEditTiming(full.billingTiming ?? 'ADVANCE');
    } catch {
      setError(t.error);
    } finally {
      setBusy('');
    }
  };

  const saveTiming = async () => {
    if (!selected) return;
    setBusy('save');
    setMessage('');
    try {
      const updated = await api<Contract>(`/contracts/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ billingTiming: editTiming }),
      });
      setSelected(updated);
      setEditTiming(updated.billingTiming);
      setMessage(t.saved);
      await load();
    } catch {
      setError(t.error);
    } finally {
      setBusy('');
    }
  };

  const generateInvoice = async () => {
    if (!selected) return;
    setBusy('invoice');
    setMessage('');
    try {
      const inv = await api<{ number: string }>(
        `/finance/contracts/${selected.id}/invoices`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setMessage(`${t.contracts.generateInvoice}: ${inv.number}`);
      const full = await api<Contract>(`/contracts/${selected.id}`);
      setSelected(full);
    } catch {
      setError(t.error);
    } finally {
      setBusy('');
    }
  };

  const createContract = async () => {
    setBusy('create');
    setMessage('');
    setError('');
    const eq = equipment.find((e) => e.id === createForm.equipmentId);
    if (!eq || !createForm.customerId || !createForm.branchId) {
      setError(t.error);
      setBusy('');
      return;
    }
    try {
      const created = await api<Contract>('/contracts', {
        method: 'POST',
        body: JSON.stringify({
          customerId: createForm.customerId,
          branchId: createForm.branchId,
          billingPeriod: createForm.billingPeriod,
          billingTiming: createForm.billingTiming,
          startDate: new Date(createForm.startDate).toISOString(),
          endDate: new Date(createForm.endDate).toISOString(),
          lines: [
            {
              equipmentId: eq.id,
              description: `${eq.brand} ${eq.model} · ${eq.code}`,
              billingPeriod: createForm.billingPeriod,
              unitRate: Number(createForm.unitRate) || 0,
            },
          ],
        }),
      });
      setMessage(`${t.contracts.createSubmit}: ${created.number}`);
      setShowCreate(false);
      await load();
      setSelected(created);
      setEditTiming(created.billingTiming);
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy('');
    }
  };

  const runDelete = async () => {
    if (!selected) return;
    setBusy('delete');
    setError('');
    setMessage('');
    try {
      const qs = hardDelete ? '?hard=1' : '';
      await api(`/contracts/${selected.id}${qs}`, { method: 'DELETE' });
      setMessage(
        hardDelete ? t.contracts.hardDeleteDone : t.contracts.archiveDone,
      );
      setConfirmOpen(false);
      setSelected(null);
      await load();
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy('');
    }
  };

  return (
    <AppShell>
      <PageHeader title={t.contracts.title} subtitle={t.contracts.subtitle} />
      {error ? <p className="error-msg">{error}</p> : null}
      <p className="muted" style={{ marginTop: '-0.6rem', marginBottom: '1rem' }}>
        {t.contracts.billingTimingHelp}
      </p>
      {message && !selected ? <p className="ok-msg">{message}</p> : null}

      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (showCreate) {
              setShowCreate(false);
            } else {
              setSelected(null);
              setShowCreate(true);
            }
            setError('');
            setMessage('');
          }}
        >
          {showCreate ? t.contracts.cancel : t.contracts.create}
        </button>
      </div>

      {showCreate ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{t.contracts.create}</h2>
          <div className="form-grid">
            <label className="field">
              <span>{t.contracts.customer}</span>
              <select
                value={createForm.customerId}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, customerId: e.target.value }))
                }
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
                value={createForm.branchId}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, branchId: e.target.value }))
                }
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.contracts.equipment}</span>
              <select
                value={createForm.equipmentId}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, equipmentId: e.target.value }))
                }
              >
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.code} · {eq.brand} {eq.model}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.contracts.period}</span>
              <select
                value={createForm.billingPeriod}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, billingPeriod: e.target.value }))
                }
              >
                <option value="WEEKLY">{t.status.WEEKLY}</option>
                <option value="MONTHLY">{t.status.MONTHLY}</option>
                <option value="YEARLY">{t.status.YEARLY}</option>
              </select>
            </label>
            <label className="field">
              <span>{t.contracts.billingTiming}</span>
              <select
                value={createForm.billingTiming}
                onChange={(e) =>
                  setCreateForm((p) => ({
                    ...p,
                    billingTiming: e.target.value as BillingTiming,
                  }))
                }
              >
                <option value="ADVANCE">{t.contracts.advance}</option>
                <option value="ARREARS">{t.contracts.arrears}</option>
              </select>
            </label>
            <label className="field">
              <span>{t.contracts.unitRate}</span>
              <input
                type="number"
                min={0}
                value={createForm.unitRate}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, unitRate: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>{t.contracts.dates}</span>
              <div className="date-row">
                <input
                  type="date"
                  value={createForm.startDate}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, startDate: e.target.value }))
                  }
                />
                <input
                  type="date"
                  value={createForm.endDate}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, endDate: e.target.value }))
                  }
                />
              </div>
            </label>
          </div>
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy === 'create'}
              onClick={createContract}
            >
              {t.contracts.createSubmit}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <DataTable
          headers={[
            t.contracts.number,
            t.contracts.customer,
            t.fleet.branch,
            t.contracts.period,
            t.contracts.billingTiming,
            t.contracts.dates,
            t.contracts.status,
            t.contracts.amendments,
          ]}
          empty={t.empty}
          rows={rows.map((c) => [
            <button
              type="button"
              className="linkish"
              key="n"
              onClick={() => open(c.id)}
            >
              <strong>{c.number}</strong>
              <div className="muted">{c.lines[0]?.description}</div>
            </button>,
            c.customer.legalName,
            c.branch.code,
            t.status[c.billingPeriod as keyof typeof t.status] ?? c.billingPeriod,
            <span className="badge warn" key="bt">
              {timingLabel(c.billingTiming ?? 'ADVANCE', t)}
            </span>,
            `${formatDate(c.startDate, locale)} → ${formatDate(c.endDate, locale)}`,
            <span className="badge" key="s">
              {c.status}
            </span>,
            c.amendments[0]?.notes ?? c.amendments[0]?.type ?? '—',
          ])}
        />
      </section>

      {selected ? (
        <section className="panel detail-panel" style={{ marginTop: '1rem' }}>
          <div className="detail-head">
            <h2>
              {t.contracts.detail}: {selected.number}
            </h2>
            <button
              type="button"
              className="ghost"
              onClick={() => setSelected(null)}
            >
              {t.contracts.close}
            </button>
          </div>
          <p>
            {selected.customer.legalName} · {selected.branch.code} ·{' '}
            <span className="badge">{selected.status}</span>
          </p>
          <p>
            {t.contracts.period}:{' '}
            {t.status[selected.billingPeriod as keyof typeof t.status] ??
              selected.billingPeriod}{' '}
            · {formatDate(selected.startDate, locale)} →{' '}
            {formatDate(selected.endDate, locale)}
          </p>
          {selected.notes ? <p className="muted">{selected.notes}</p> : null}

          <label className="field">
            <span>{t.contracts.billingTiming}</span>
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
              {t.contracts.save}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy === 'invoice'}
              onClick={generateInvoice}
            >
              {t.contracts.generateInvoice}
            </button>
            {master ? (
              <button
                type="button"
                className="ghost danger-btn"
                onClick={() => {
                  setHardDelete(selected.status === 'DRAFT');
                  setConfirmOpen(true);
                }}
              >
                {selected.status === 'DRAFT'
                  ? t.contracts.hardDelete
                  : t.contracts.archive}
              </button>
            ) : null}
          </div>
          {message ? <p className="ok-msg">{message}</p> : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmOpen && Boolean(selected)}
        title={t.masterDelete.title}
        entityLabel={selected?.number ?? ''}
        message={t.masterDelete.contractMsg}
        confirmLabel={
          hardDelete ? t.contracts.hardDelete : t.contracts.archive
        }
        cancelLabel={t.masterDelete.cancel}
        busy={busy === 'delete'}
        onConfirm={runDelete}
        onCancel={() => setConfirmOpen(false)}
      >
        <label
          className="field"
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        >
          <input
            type="checkbox"
            checked={hardDelete}
            onChange={(e) => setHardDelete(e.target.checked)}
          />
          <span>{t.masterDelete.hardOption}</span>
        </label>
      </ConfirmDialog>
    </AppShell>
  );
}
