'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, isMasterAdmin } from '@/lib/api';

type Equipment = {
  id: string;
  code: string;
  brand: string;
  model: string;
  year?: number | null;
  serialNumber?: string | null;
  vin?: string | null;
  frameNumber?: string | null;
  plate?: string | null;
  hourMeter: number;
  status: string;
  notes?: string | null;
  categoryId?: string;
  branchId?: string;
  category: { id?: string; name: string; nameEn?: string | null };
  branch: { id?: string; code: string; name: string };
};

type Category = { id: string; code: string; name: string; nameEn?: string | null };
type Branch = { id: string; code: string; name: string };

type MachineForm = {
  code: string;
  categoryId: string;
  branchId: string;
  brand: string;
  model: string;
  year: string;
  serialNumber: string;
  vin: string;
  frameNumber: string;
  plate: string;
  hourMeter: string;
  status: string;
  notes: string;
};

const emptyForm = (): MachineForm => ({
  code: '',
  categoryId: '',
  branchId: '',
  brand: '',
  model: '',
  year: '',
  serialNumber: '',
  vin: '',
  frameNumber: '',
  plate: '',
  hourMeter: '0',
  status: 'AVAILABLE',
  notes: '',
});

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

function formFromEquipment(eq: Equipment): MachineForm {
  return {
    code: eq.code || '',
    categoryId: eq.categoryId || eq.category?.id || '',
    branchId: eq.branchId || eq.branch?.id || '',
    brand: eq.brand || '',
    model: eq.model || '',
    year: eq.year != null ? String(eq.year) : '',
    serialNumber: eq.serialNumber || '',
    vin: eq.vin || '',
    frameNumber: eq.frameNumber || '',
    plate: eq.plate || '',
    hourMeter: String(eq.hourMeter ?? 0),
    status: eq.status || 'AVAILABLE',
    notes: eq.notes || '',
  };
}

function payloadFromForm(form: MachineForm) {
  return {
    code: form.code.trim() || undefined,
    categoryId: form.categoryId,
    branchId: form.branchId,
    brand: form.brand.trim(),
    model: form.model.trim(),
    year: form.year.trim() ? Number(form.year) : null,
    serialNumber: form.serialNumber.trim() || null,
    vin: form.vin.trim() || null,
    frameNumber: form.frameNumber.trim() || null,
    plate: form.plate.trim() || null,
    hourMeter: form.hourMeter.trim() ? Number(form.hourMeter) : 0,
    status: form.status,
    notes: form.notes.trim() || null,
  };
}

export default function FleetPage() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<MachineForm>(emptyForm());
  const [master, setMaster] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retireMode, setRetireMode] = useState<
    'sold' | 'retired' | 'unavailable' | 'hard'
  >('retired');

  const load = async () => {
    try {
      const [eq, cats, br] = await Promise.all([
        api<Equipment[]>('/equipment'),
        api<Category[]>('/equipment/categories'),
        api<Branch[]>('/branches'),
      ]);
      setRows(eq);
      setCategories(cats);
      setBranches(br);
      setForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId || cats[0]?.id || '',
        branchId: prev.branchId || br[0]?.id || '',
      }));
    } catch {
      setError(t.error);
    }
  };

  useEffect(() => {
    setMaster(isMasterAdmin());
    load();
  }, [t.error]);

  const openCreate = () => {
    setSelected(null);
    setEditing(false);
    setShowCreate(true);
    setForm({
      ...emptyForm(),
      categoryId: categories[0]?.id || '',
      branchId: branches[0]?.id || '',
    });
    setError('');
    setMessage('');
  };

  const openDetail = async (id: string) => {
    setShowCreate(false);
    setEditing(false);
    setError('');
    setMessage('');
    try {
      const full = await api<Equipment>(`/equipment/${id}`);
      setSelected(full);
      setForm(formFromEquipment(full));
    } catch (err) {
      setError(apiError(err, t.error));
    }
  };

  const createMachine = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await api<Equipment>('/equipment', {
        method: 'POST',
        body: JSON.stringify(payloadFromForm(form)),
      });
      setShowCreate(false);
      setMessage(`${t.fleet.created}: ${created.code}`);
      await load();
      await openDetail(created.id);
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy(false);
    }
  };

  const saveMachine = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await api<Equipment>(`/equipment/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payloadFromForm(form)),
      });
      setSelected(updated);
      setForm(formFromEquipment(updated));
      setEditing(false);
      setMessage(`${t.fleet.updated}: ${updated.code}`);
      await load();
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy(false);
    }
  };

  const runRetire = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/equipment/${selected.id}?mode=${retireMode}`, {
        method: 'DELETE',
      });
      setMessage(
        retireMode === 'hard' ? t.fleet.hardDeleteDone : t.fleet.retireDone,
      );
      setConfirmOpen(false);
      setSelected(null);
      await load();
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy(false);
    }
  };

  const statusOptions = [
    'AVAILABLE',
    'RESERVED',
    'ON_RENT',
    'IN_TRANSIT',
    'MAINTENANCE',
    'QUARANTINE',
    'SOLD',
    'RETIRED',
  ] as const;

  const renderFormFields = (disabled: boolean) => (
    <div className="form-grid">
      <label className="field">
        <span>{t.fleet.make}</span>
        <input
          value={form.brand}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, brand: e.target.value })}
          required
        />
      </label>
      <label className="field">
        <span>{t.fleet.model}</span>
        <input
          value={form.model}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
          required
        />
      </label>
      <label className="field">
        <span>{t.fleet.year}</span>
        <input
          type="number"
          min={1950}
          max={2100}
          value={form.year}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, year: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.fleet.serial}</span>
        <input
          value={form.serialNumber}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.fleet.vin}</span>
        <input
          value={form.vin}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, vin: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.fleet.frameNumber}</span>
        <input
          value={form.frameNumber}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, frameNumber: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.fleet.category}</span>
        <select
          value={form.categoryId}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {locale === 'en' && c.nameEn ? c.nameEn : c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t.fleet.branch}</span>
        <select
          value={form.branchId}
          disabled={disabled}
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
        <span>{t.fleet.plate}</span>
        <input
          value={form.plate}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, plate: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.fleet.hourMeter}</span>
        <input
          type="number"
          min={0}
          step="0.1"
          value={form.hourMeter}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, hourMeter: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.fleet.status}</span>
        <select
          value={form.status}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t.fleet.code}</span>
        <input
          value={form.code}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="EQ-0042"
        />
      </label>
      <label className="field" style={{ gridColumn: '1 / -1' }}>
        <span>{t.fleet.notes}</span>
        <input
          value={form.notes}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>
    </div>
  );

  return (
    <AppShell>
      <PageHeader title={t.fleet.title} subtitle={t.fleet.subtitle} />
      {error ? <p className="error-msg">{error}</p> : null}
      {message ? <p className="ok-msg">{message}</p> : null}

      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (showCreate) {
              setShowCreate(false);
            } else {
              openCreate();
            }
          }}
        >
          {showCreate ? t.fleet.cancel : t.fleet.addMachine}
        </button>
      </div>

      {showCreate ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{t.fleet.addMachine}</h2>
          <p className="muted">{t.fleet.codeHint}</p>
          {renderFormFields(false)}
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={
                busy ||
                !form.brand.trim() ||
                !form.model.trim() ||
                !form.categoryId ||
                !form.branchId
              }
              onClick={createMachine}
            >
              {t.fleet.create}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <DataTable
          headers={[
            t.fleet.code,
            t.fleet.make,
            t.fleet.model,
            t.fleet.year,
            t.fleet.type,
            t.fleet.branch,
            t.fleet.hours,
            t.fleet.status,
          ]}
          empty={t.empty}
          rows={rows.map((eq) => [
            <button
              type="button"
              className="linkish"
              key="c"
              onClick={() => openDetail(eq.id)}
            >
              <strong>{eq.code}</strong>
            </button>,
            eq.brand,
            eq.model,
            eq.year != null ? String(eq.year) : '—',
            locale === 'en' && eq.category.nameEn
              ? eq.category.nameEn
              : eq.category.name,
            `${eq.branch.code} — ${eq.branch.name}`,
            String(eq.hourMeter),
            <span className="badge" key="s">
              {t.status[eq.status as keyof typeof t.status] ?? eq.status}
            </span>,
          ])}
        />
      </section>

      {selected ? (
        <section className="panel detail-panel" style={{ marginTop: '1rem' }}>
          <div className="detail-head">
            <h2>
              {t.fleet.detail}: {selected.code}
            </h2>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setSelected(null);
                setEditing(false);
              }}
            >
              {t.fleet.close}
            </button>
          </div>
          {!editing ? (
            <>
              <p>
                <strong>
                  {selected.brand} {selected.model}
                </strong>
                {selected.year != null ? ` · ${selected.year}` : ''}
                {' · '}
                <span className="badge">
                  {t.status[selected.status as keyof typeof t.status] ??
                    selected.status}
                </span>
              </p>
              <ul>
                <li>
                  {t.fleet.category}:{' '}
                  {locale === 'en' && selected.category.nameEn
                    ? selected.category.nameEn
                    : selected.category.name}
                </li>
                <li>
                  {t.fleet.branch}: {selected.branch.code} —{' '}
                  {selected.branch.name}
                </li>
                <li>
                  {t.fleet.serial}: {selected.serialNumber || '—'}
                </li>
                <li>
                  {t.fleet.vin}: {selected.vin || '—'}
                </li>
                <li>
                  {t.fleet.frameNumber}: {selected.frameNumber || '—'}
                </li>
                <li>
                  {t.fleet.plate}: {selected.plate || '—'}
                </li>
                <li>
                  {t.fleet.hourMeter}: {selected.hourMeter}
                </li>
                {selected.notes ? (
                  <li>
                    {t.fleet.notes}: {selected.notes}
                  </li>
                ) : null}
              </ul>
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setForm(formFromEquipment(selected));
                    setEditing(true);
                  }}
                >
                  {t.fleet.edit}
                </button>
                {master ? (
                  <button
                    type="button"
                    className="ghost danger-btn"
                    onClick={() => {
                      setRetireMode('retired');
                      setConfirmOpen(true);
                    }}
                  >
                    {t.fleet.retire}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              {renderFormFields(false)}
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  disabled={busy || !form.brand.trim() || !form.model.trim()}
                  onClick={saveMachine}
                >
                  {t.fleet.save}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setForm(formFromEquipment(selected));
                    setEditing(false);
                  }}
                >
                  {t.fleet.cancel}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmOpen && Boolean(selected)}
        title={t.masterDelete.title}
        entityLabel={selected?.code ?? ''}
        message={t.masterDelete.equipmentMsg}
        confirmLabel={
          retireMode === 'hard' ? t.fleet.modeHard : t.fleet.retire
        }
        cancelLabel={t.masterDelete.cancel}
        busy={busy}
        onConfirm={runRetire}
        onCancel={() => setConfirmOpen(false)}
      >
        <label className="field">
          <span>{t.fleet.status}</span>
          <select
            value={retireMode}
            onChange={(e) =>
              setRetireMode(
                e.target.value as 'sold' | 'retired' | 'unavailable' | 'hard',
              )
            }
          >
            <option value="sold">{t.fleet.modeSold}</option>
            <option value="retired">{t.fleet.modeRetired}</option>
            <option value="unavailable">{t.fleet.modeUnavailable}</option>
            <option value="hard">{t.fleet.modeHard}</option>
          </select>
        </label>
      </ConfirmDialog>
    </AppShell>
  );
}
