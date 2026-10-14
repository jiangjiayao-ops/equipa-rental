'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, downloadApiFile, formatBrl } from '@/lib/api';
import { whatsappDeepLink } from '@/lib/whatsapp';

type BillingTiming = 'ADVANCE' | 'ARREARS';
type BillingPeriod = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type HoursMode = 'default' | 'unlimited' | 'custom';

type Option = {
  id?: string;
  label: string;
  billingPeriod: BillingPeriod;
  durationDays: number;
  unitRate: number;
  mobFee: number;
  demobFee: number;
};

type Customer = {
  id: string;
  legalName: string;
  email?: string | null;
  phone?: string | null;
};
type Branch = { id: string; code: string; name: string };
type StaffUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
  role?: string;
};
type Equipment = {
  id: string;
  code: string;
  brand: string;
  model: string;
  status: string;
  branchId?: string;
  branch?: { id?: string; code: string; name?: string };
  category?: { name: string };
};

type Proposal = {
  id: string;
  number: string;
  status: string;
  billingTiming: BillingTiming;
  allowedHours?: number;
  hoursUnlimited?: boolean;
  publicToken?: string | null;
  notes?: string | null;
  validUntil?: string | null;
  ownerId?: string | null;
  owner?: StaffUser | null;
  customer: { id?: string; legalName: string; email?: string | null; phone?: string | null };
  branch: { id?: string; code: string; name?: string };
  lines: Array<{
    billingPeriod: string;
    unitRate: number;
    description: string;
    equipmentId?: string | null;
    equipment?: Equipment | null;
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

function ProposalsPageInner() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  /** Capture once so clearing the URL cannot drop the preselect. */
  const launchQuery = useRef({
    customerId: searchParams.get('customerId') || '',
    openNew: searchParams.get('new') === '1',
  });
  const preselectCustomerId = launchQuery.current.customerId;
  const openCreateFromQuery = launchQuery.current.openNew;

  const [rows, setRows] = useState<Proposal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState('');
  const [notifyConfig, setNotifyConfig] = useState<{
    email: string;
    whatsapp: string;
  } | null>(null);
  const [queryApplied, setQueryApplied] = useState(false);

  /** Default off so contracted machines can be quoted; toggle to restrict. */
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [fleetBranchId, setFleetBranchId] = useState('');
  const [fleetSearch, setFleetSearch] = useState('');
  const [pickedId, setPickedId] = useState('');
  const [selectedMachines, setSelectedMachines] = useState<Equipment[]>([]);
  const [hoursMode, setHoursMode] = useState<HoursMode>('default');
  const [customHours, setCustomHours] = useState(200);

  const [form, setForm] = useState({
    customerId: '',
    branchId: '',
    ownerId: '',
    billingTiming: 'ADVANCE' as BillingTiming,
    validUntil: '',
    notes: '',
    options: defaultOptions(),
  });

  const formatHoursLabel = (p: {
    hoursUnlimited?: boolean;
    allowedHours?: number;
  }) =>
    p.hoursUnlimited
      ? t.proposals.hoursUnlimited
      : `${p.allowedHours ?? 200}`;

  const filteredFleet = useMemo(() => {
    const q = fleetSearch.trim().toLowerCase();
    return equipment.filter((eq) => {
      if (onlyAvailable && eq.status !== 'AVAILABLE') return false;
      if (fleetBranchId) {
        const bid = eq.branchId || eq.branch?.id;
        if (bid !== fleetBranchId) return false;
      }
      if (selectedMachines.some((m) => m.id === eq.id)) return false;
      if (!q) return true;
      const hay = `${eq.code} ${eq.brand} ${eq.model} ${eq.branch?.code ?? ''} ${eq.category?.name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [equipment, onlyAvailable, fleetBranchId, fleetSearch, selectedMachines]);

  const load = async () => {
    try {
      const [props, cust, br, eq, owners, cfg] = await Promise.all([
        api<Proposal[]>('/proposals'),
        api<Customer[]>('/customers'),
        api<Branch[]>('/branches'),
        api<Equipment[]>('/equipment'),
        api<StaffUser[]>('/users/assignable').catch(() => []),
        api<{ email: string; whatsapp: string }>('/proposals/notify-config').catch(
          () => ({ email: 'not_configured', whatsapp: 'not_configured' }),
        ),
      ]);
      setRows(props);
      setCustomers(cust);
      setBranches(br);
      setEquipment(eq);
      setStaff(owners);
      setNotifyConfig(cfg);
      setForm((prev) => {
        const fromQuery =
          preselectCustomerId &&
          cust.some((c) => c.id === preselectCustomerId)
            ? preselectCustomerId
            : '';
        return {
          ...prev,
          customerId: fromQuery || prev.customerId || cust[0]?.id || '',
          branchId: prev.branchId || br[0]?.id || '',
          ownerId: prev.ownerId || owners[0]?.id || '',
        };
      });
      setPickedId(eq[0]?.id || '');
    } catch (err) {
      setError(apiError(err, t.error));
    }
  };

  useEffect(() => {
    load();
  }, [t.error]);

  useEffect(() => {
    if (queryApplied) return;
    if (!openCreateFromQuery && !preselectCustomerId) return;
    if (!customers.length) return;
    if (
      preselectCustomerId &&
      customers.some((c) => c.id === preselectCustomerId)
    ) {
      setForm((prev) => ({ ...prev, customerId: preselectCustomerId }));
    }
    if (openCreateFromQuery) setShowCreate(true);
    setQueryApplied(true);
    router.replace('/propostas', { scroll: false });
  }, [
    customers,
    openCreateFromQuery,
    preselectCustomerId,
    queryApplied,
    router,
  ]);

  useEffect(() => {
    if (!filteredFleet.some((e) => e.id === pickedId)) {
      setPickedId(filteredFleet[0]?.id || '');
    }
  }, [filteredFleet, pickedId]);

  const open = async (id: string) => {
    setMessage('');
    setPublicUrl('');
    try {
      const full = await api<Proposal>(`/proposals/${id}`);
      setSelected(full);
      if (full.publicToken) {
        setPublicUrl(`${window.location.origin}/p/${full.publicToken}`);
      }
    } catch (err) {
      setError(apiError(err, t.error));
    }
  };

  const addMachine = () => {
    const eq = equipment.find((e) => e.id === pickedId) || filteredFleet[0];
    if (!eq) return;
    if (selectedMachines.some((m) => m.id === eq.id)) return;
    setSelectedMachines((prev) => [...prev, eq]);
    const next = filteredFleet.find((m) => m.id !== eq.id);
    setPickedId(next?.id || '');
  };

  const buildProposalBody = () => {
    const hoursUnlimited = hoursMode === 'unlimited';
    const allowedHours =
      hoursMode === 'custom'
        ? Number(customHours) || 200
        : hoursMode === 'default'
          ? 200
          : hoursMode === 'unlimited'
            ? undefined
            : Number(customHours) || 200;
    return {
      customerId: form.customerId,
      branchId: form.branchId,
      ownerId: form.ownerId || undefined,
      billingTiming: form.billingTiming,
      validUntil: form.validUntil || undefined,
      notes: form.notes || undefined,
      hoursUnlimited,
      allowedHours: hoursUnlimited ? undefined : allowedHours,
      lines: selectedMachines.map((m) => ({ equipmentId: m.id })),
      options: form.options.map((o, i) => ({
        label: o.label,
        billingPeriod: o.billingPeriod,
        durationDays: Number(o.durationDays),
        unitRate: Number(o.unitRate),
        mobFee: Number(o.mobFee) || 0,
        demobFee: Number(o.demobFee) || 0,
        sortOrder: i,
      })),
    };
  };

  const resetEditor = () => {
    setShowCreate(false);
    setEditingId(null);
    setSelectedMachines([]);
    setHoursMode('default');
    setCustomHours(200);
    setForm((prev) => ({
      ...prev,
      notes: '',
      validUntil: '',
      billingTiming: 'ADVANCE',
      options: defaultOptions(),
    }));
  };

  const startEditDraft = (proposal: Proposal) => {
    if (proposal.status !== 'DRAFT') {
      setError(t.proposals.lockedHint);
      return;
    }
    const machines = proposal.lines
      .map((l) => {
        if (l.equipment) return l.equipment as Equipment;
        return equipment.find((e) => e.id === l.equipmentId) || null;
      })
      .filter((m): m is Equipment => Boolean(m));

    let mode: HoursMode = 'default';
    let custom = 200;
    if (proposal.hoursUnlimited) mode = 'unlimited';
    else if (proposal.allowedHours != null && proposal.allowedHours !== 200) {
      mode = 'custom';
      custom = proposal.allowedHours;
    }

    setEditingId(proposal.id);
    setShowCreate(true);
    setSelected(null);
    setSelectedMachines(machines);
    setHoursMode(mode);
    setCustomHours(custom);
    setForm({
      customerId: proposal.customer.id || form.customerId,
      branchId: proposal.branch.id || form.branchId,
      ownerId: proposal.ownerId || proposal.owner?.id || form.ownerId,
      billingTiming: proposal.billingTiming || 'ADVANCE',
      validUntil: proposal.validUntil
        ? proposal.validUntil.slice(0, 10)
        : '',
      notes: proposal.notes || '',
      options:
        proposal.options && proposal.options.length
          ? proposal.options.map((o) => ({
              label: o.label,
              billingPeriod: o.billingPeriod,
              durationDays: o.durationDays,
              unitRate: o.unitRate,
              mobFee: o.mobFee,
              demobFee: o.demobFee,
            }))
          : defaultOptions(),
    });
    setError('');
    setMessage('');
  };

  const createProposal = async () => {
    if (!selectedMachines.length) {
      setError(t.proposals.selectMachineHint);
      return;
    }
    setBusy('create');
    setError('');
    setMessage('');
    try {
      const created = await api<Proposal>('/proposals', {
        method: 'POST',
        body: JSON.stringify(buildProposalBody()),
      });
      resetEditor();
      setMessage(`${t.proposals.create}: ${created.number}`);
      await load();
      await open(created.id);
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy('');
    }
  };

  const saveDraft = async () => {
    if (!editingId) return;
    if (!selectedMachines.length) {
      setError(t.proposals.selectMachineHint);
      return;
    }
    setBusy('save');
    setError('');
    setMessage('');
    try {
      const updated = await api<Proposal>(`/proposals/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(buildProposalBody()),
      });
      resetEditor();
      setMessage(`${t.proposals.updated}: ${updated.number}`);
      await load();
      await open(updated.id);
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
      setMessage(
        `${t.proposals.send}: ${(res.attempts ?? [])
          .map((a) => `${a.channel}:${a.status}`)
          .join(', ')}`,
      );
      await load();
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy('');
    }
  };

  const downloadPdf = async () => {
    if (!selected) return;
    setBusy('pdf');
    setError('');
    try {
      await downloadApiFile(
        `/proposals/${selected.id}/pdf?locale=${locale === 'en' ? 'en' : 'pt-BR'}`,
        `${selected.number}.pdf`,
      );
      setMessage(t.proposals.downloadPdf);
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

  const updateOption = (idx: number, patch: Partial<Option>) => {
    const options = [...form.options];
    options[idx] = { ...options[idx], ...patch };
    setForm({ ...form, options });
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
            if (showCreate) {
              resetEditor();
            } else {
              setEditingId(null);
              setShowCreate(true);
              setSelected(null);
              setSelectedMachines([]);
              setHoursMode('default');
              setCustomHours(200);
              setForm((prev) => ({
                ...prev,
                notes: '',
                validUntil: '',
                billingTiming: 'ADVANCE',
                options: defaultOptions(),
              }));
            }
            setError('');
          }}
        >
          {showCreate ? t.proposals.cancel : t.proposals.newProposal}
        </button>
      </div>

      {showCreate ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>
            {editingId ? t.proposals.editing : t.proposals.newProposal}
          </h2>
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
              <span>{t.proposals.owner}</span>
              <select
                value={form.ownerId}
                onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              >
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
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
              <span>{t.proposals.allowedHours}</span>
              <select
                value={hoursMode}
                onChange={(e) => setHoursMode(e.target.value as HoursMode)}
              >
                <option value="default">{t.proposals.hoursDefault}</option>
                <option value="unlimited">{t.proposals.hoursUnlimited}</option>
                <option value="custom">{t.proposals.hoursCustom}</option>
              </select>
            </label>
            {hoursMode === 'custom' ? (
              <label className="field">
                <span>{t.proposals.hoursValue}</span>
                <input
                  type="number"
                  min={1}
                  value={customHours}
                  onChange={(e) => setCustomHours(Number(e.target.value))}
                />
              </label>
            ) : null}
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>{t.proposals.notes}</span>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <p className="muted">{t.proposals.hoursPerPeriod}</p>

          <h3 style={{ marginTop: '1.25rem' }}>{t.proposals.fleetPicker}</h3>
          <p className="muted">{t.proposals.onRentHint}</p>
          <div className="fleet-toolbar">
            <label className="field" style={{ margin: 0, flex: 1 }}>
              <span>{t.proposals.searchFleet}</span>
              <input
                value={fleetSearch}
                onChange={(e) => setFleetSearch(e.target.value)}
                placeholder="EQ-… / XCMG / Hangcha"
              />
            </label>
            <label className="field" style={{ margin: 0, minWidth: 180 }}>
              <span>{t.proposals.filterBranch}</span>
              <select
                value={fleetBranchId}
                onChange={(e) => setFleetBranchId(e.target.value)}
              >
                <option value="">{t.proposals.allBranches}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="check-toggle">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
              />
              <span>{t.proposals.onlyAvailable}</span>
            </label>
          </div>
          {!onlyAvailable ? (
            <p className="muted">{t.proposals.includeOnRent}</p>
          ) : null}

          <div className="fleet-picker-row">
            <select
              value={pickedId}
              onChange={(e) => setPickedId(e.target.value)}
              className="fleet-select"
            >
              {filteredFleet.length === 0 ? (
                <option value="">{t.proposals.noAvailable}</option>
              ) : (
                filteredFleet.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.code} · {eq.brand} {eq.model} ·{' '}
                    {t.status[eq.status as keyof typeof t.status] ?? eq.status}
                    {eq.branch ? ` · ${eq.branch.code}` : ''}
                    {eq.status !== 'AVAILABLE' ? ' ⚠' : ''}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              className="ghost"
              disabled={!pickedId || filteredFleet.length === 0}
              onClick={addMachine}
            >
              {t.proposals.addMachine}
            </button>
          </div>

          <h4>{t.proposals.selectedMachines}</h4>
          {selectedMachines.length === 0 ? (
            <p className="muted">{t.proposals.selectMachineHint}</p>
          ) : (
            <ul className="machine-chips">
              {selectedMachines.map((m) => (
                <li key={m.id}>
                  <strong>{m.code}</strong> {m.brand} {m.model}
                  {m.branch ? (
                    <span className="muted"> · {m.branch.code}</span>
                  ) : null}
                  {m.status !== 'AVAILABLE' ? (
                    <span className="badge warn">
                      {m.status === 'ON_RENT'
                        ? t.proposals.onRentWarning
                        : t.status[m.status as keyof typeof t.status] ??
                          m.status}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="chip-x"
                    onClick={() =>
                      setSelectedMachines((prev) =>
                        prev.filter((x) => x.id !== m.id),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 style={{ marginTop: '1.4rem' }}>{t.proposals.options}</h3>
          <div className="period-sections">
            {form.options.map((opt, idx) => (
              <section className="period-card" key={idx}>
                <header className="period-card-head">
                  <span className="period-badge">
                    {t.proposals.periodPackage} {idx + 1}
                  </span>
                  <strong>
                    {opt.durationDays}d ·{' '}
                    {t.status[opt.billingPeriod as keyof typeof t.status]}
                  </strong>
                </header>
                <div className="form-grid">
                  <label className="field">
                    <span>{t.proposals.optionLabel}</span>
                    <input
                      value={opt.label}
                      onChange={(e) => updateOption(idx, { label: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>{t.proposals.period}</span>
                    <select
                      value={opt.billingPeriod}
                      onChange={(e) =>
                        updateOption(idx, {
                          billingPeriod: e.target.value as BillingPeriod,
                        })
                      }
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
                      onChange={(e) =>
                        updateOption(idx, {
                          durationDays: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t.proposals.unitRate}</span>
                    <input
                      type="number"
                      min={0}
                      value={opt.unitRate}
                      onChange={(e) =>
                        updateOption(idx, { unitRate: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t.proposals.mobFee}</span>
                    <input
                      type="number"
                      min={0}
                      value={opt.mobFee}
                      onChange={(e) =>
                        updateOption(idx, { mobFee: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t.proposals.demobFee}</span>
                    <input
                      type="number"
                      min={0}
                      value={opt.demobFee}
                      onChange={(e) =>
                        updateOption(idx, { demobFee: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              </section>
            ))}
          </div>

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
              disabled={busy === 'create' || busy === 'save'}
              onClick={editingId ? saveDraft : createProposal}
            >
              {editingId ? t.proposals.save : t.proposals.create}
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
              ? p.options.map((o) => o.label).join(' · ')
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
            {' · '}
            {t.proposals.allowedHours}: {formatHoursLabel(selected)}
          </p>
          {selected.status !== 'DRAFT' ? (
            <p className="muted">{t.proposals.lockedHint}</p>
          ) : null}

          {selected.owner ? (
            <section style={{ margin: '0.75rem 0 1rem' }}>
              <h3>{t.proposals.contactBlock}</h3>
              <p>
                <strong>{selected.owner.name}</strong>
                {selected.owner.phone ? (
                  <>
                    <br />
                    {selected.owner.phone}
                  </>
                ) : null}
              </p>
              <div className="actions" style={{ marginTop: '0.4rem' }}>
                {selected.owner.email ? (
                  <a
                    className="ghost"
                    href={`mailto:${selected.owner.email}?subject=${encodeURIComponent(selected.number)}`}
                  >
                    {t.proposals.emailLink}
                  </a>
                ) : null}
                {whatsappDeepLink(
                  selected.owner.whatsapp || selected.owner.phone,
                  selected.number,
                  locale === 'en' ? 'en' : 'pt-BR',
                ) ? (
                  <a
                    className="ghost"
                    href={
                      whatsappDeepLink(
                        selected.owner.whatsapp || selected.owner.phone,
                        selected.number,
                        locale === 'en' ? 'en' : 'pt-BR',
                      )!
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.proposals.openWhatsApp}
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          <h3>{t.proposals.equipment}</h3>
          <ul>
            {selected.lines.map((l, i) => (
              <li key={i}>{l.description}</li>
            ))}
          </ul>

          <h3>{t.proposals.options}</h3>
          <div className="period-sections">
            {(selected.options ?? []).map((o, idx) => (
              <section className="period-card" key={o.id ?? idx}>
                <header className="period-card-head">
                  <span className="period-badge">{o.label}</span>
                  <strong>
                    {o.durationDays}d ·{' '}
                    {t.status[o.billingPeriod as keyof typeof t.status]}
                  </strong>
                </header>
                <p>
                  {formatBrl(o.unitRate)}
                  {(o.mobFee || o.demobFee) > 0
                    ? ` · mob ${formatBrl(o.mobFee)} / demob ${formatBrl(o.demobFee)}`
                    : ''}
                </p>
              </section>
            ))}
          </div>

          <p className="muted">{t.proposals.sendHelp}</p>
          {notifyConfig ? (
            <p className="muted">
              Email: {notifyConfig.email} · WhatsApp: {notifyConfig.whatsapp}
            </p>
          ) : null}

          <div className="actions">
            {selected.status === 'DRAFT' ? (
              <button
                type="button"
                className="primary"
                onClick={() => startEditDraft(selected)}
              >
                {t.proposals.editDraft}
              </button>
            ) : null}
            <button
              type="button"
              className="primary"
              disabled={busy === 'send' || selected.status === 'ACCEPTED'}
              onClick={sendProposal}
            >
              {t.proposals.send}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy === 'pdf'}
              onClick={downloadPdf}
            >
              {t.proposals.downloadPdf}
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

export default function ProposalsPage() {
  return (
    <Suspense fallback={<AppShell><p className="muted">…</p></AppShell>}>
      <ProposalsPageInner />
    </Suspense>
  );
}
