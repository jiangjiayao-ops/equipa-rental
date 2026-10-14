'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, getUserRole, isMasterAdmin } from '@/lib/api';
import {
  formatCep,
  formatCnpj,
  formatPhoneBr,
  storeCep,
  storeCnpj,
  storePhone,
} from '@/lib/brFormat';

type OrgForm = {
  id: string;
  name: string;
  tradeName?: string | null;
  cnpj: string;
  ie?: string | null;
  im?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  phone?: string | null;
  email?: string | null;
};

type BranchForm = {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  cnpj?: string | null;
  ie?: string | null;
  im?: string | null;
  street?: string | null;
  city: string;
  state: string;
  cep?: string | null;
  phone?: string | null;
  email?: string | null;
  _count?: {
    equipment: number;
    contracts?: number;
    proposals?: number;
  };
};

type CreateForm = {
  code: string;
  name: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  ie: string;
  im: string;
  street: string;
  city: string;
  state: string;
  cep: string;
  phone: string;
  email: string;
};

const emptyCreate = (): CreateForm => ({
  code: '',
  name: '',
  legalName: '',
  tradeName: '',
  cnpj: '',
  ie: '',
  im: '',
  street: '',
  city: '',
  state: '',
  cep: '',
  phone: '',
  email: '',
});

function Field({
  label,
  value,
  onChange,
  disabled,
  format,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  format?: (raw: string) => string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(format ? format(e.target.value) : e.target.value)
        }
        onBlur={(e) => {
          if (format) onChange(format(e.target.value));
        }}
      />
    </label>
  );
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (!(err instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(err.message) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join('; ');
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    /* plain text */
  }
  return err.message || fallback;
}

export default function BranchesPage() {
  const { t } = useLocale();
  const [isAdmin, setIsAdmin] = useState(false);
  const [master, setMaster] = useState(false);
  const [org, setOrg] = useState<OrgForm | null>(null);
  const [branches, setBranches] = useState<BranchForm[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [branch, setBranch] = useState<BranchForm | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate);
  const [showCreate, setShowCreate] = useState(false);
  const [showOrg, setShowOrg] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = async (preferId?: string) => {
    setError('');
    try {
      const [orgRes, branchRes] = await Promise.all([
        api<OrgForm>('/organization'),
        api<BranchForm[]>('/branches'),
      ]);
      setOrg({
        ...orgRes,
        cnpj: formatCnpj(orgRes.cnpj || ''),
        cep: formatCep(orgRes.cep || ''),
        phone: formatPhoneBr(orgRes.phone || ''),
      });
      const formatted = branchRes.map((b) => ({
        ...b,
        cnpj: formatCnpj(b.cnpj || ''),
        cep: formatCep(b.cep || ''),
        phone: formatPhoneBr(b.phone || ''),
      }));
      setBranches(formatted);
      // Only open the detail panel when explicitly preferred (e.g. after create).
      // Otherwise keep branch info collapsed like Propostas/Frota.
      if (preferId) {
        const found = formatted.find((b) => b.id === preferId);
        setSelectedId(found?.id || '');
        setBranch(found ?? null);
      } else if (selectedId) {
        const found = formatted.find((b) => b.id === selectedId);
        if (found) {
          setBranch(found);
        } else {
          setSelectedId('');
          setBranch(null);
        }
      }
    } catch (err) {
      setError(apiErrorMessage(err, t.error));
    }
  };

  useEffect(() => {
    setIsAdmin(getUserRole() === 'ADMIN');
    setMaster(isMasterAdmin());
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.error]);

  const selectBranch = (id: string) => {
    setSelectedId(id);
    setBranch(branches.find((b) => b.id === id) ?? null);
    setShowCreate(false);
    setMessage('');
    setError('');
  };

  const closeBranchDetail = () => {
    setSelectedId('');
    setBranch(null);
    setConfirmOpen(false);
  };

  const saveOrg = async () => {
    if (!org || !isAdmin) return;
    setBusy('org');
    setMessage('');
    setError('');
    try {
      const updated = await api<OrgForm>('/organization', {
        method: 'PATCH',
        body: JSON.stringify({
          name: org.name,
          tradeName: org.tradeName || null,
          cnpj: storeCnpj(org.cnpj) || org.cnpj,
          ie: org.ie || null,
          im: org.im || null,
          street: org.street || null,
          city: org.city || null,
          state: org.state || null,
          cep: storeCep(org.cep),
          phone: storePhone(org.phone),
          email: org.email || null,
        }),
      });
      setOrg({
        ...updated,
        cnpj: formatCnpj(updated.cnpj || ''),
        cep: formatCep(updated.cep || ''),
        phone: formatPhoneBr(updated.phone || ''),
      });
      setMessage(t.saved);
    } catch (err) {
      setError(apiErrorMessage(err, t.error));
    } finally {
      setBusy('');
    }
  };

  const saveBranch = async () => {
    if (!branch || !isAdmin) return;
    setBusy('branch');
    setMessage('');
    setError('');
    try {
      const updated = await api<BranchForm>(`/branches/${branch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: branch.name,
          legalName: branch.legalName || null,
          tradeName: branch.tradeName || null,
          cnpj: storeCnpj(branch.cnpj),
          ie: branch.ie || null,
          im: branch.im || null,
          street: branch.street || null,
          city: branch.city,
          state: branch.state,
          cep: storeCep(branch.cep),
          phone: storePhone(branch.phone),
          email: branch.email || null,
        }),
      });
      const formatted = {
        ...updated,
        cnpj: formatCnpj(updated.cnpj || ''),
        cep: formatCep(updated.cep || ''),
        phone: formatPhoneBr(updated.phone || ''),
      };
      setBranch(formatted);
      setBranches((prev) =>
        prev.map((b) => (b.id === formatted.id ? { ...b, ...formatted } : b)),
      );
      setMessage(t.saved);
    } catch (err) {
      setError(apiErrorMessage(err, t.error));
    } finally {
      setBusy('');
    }
  };

  const createBranch = async () => {
    if (!isAdmin) return;
    setBusy('create');
    setMessage('');
    setError('');
    try {
      const created = await api<BranchForm>('/branches', {
        method: 'POST',
        body: JSON.stringify({
          code: createForm.code.trim(),
          name: createForm.name.trim(),
          legalName: createForm.legalName || null,
          tradeName: createForm.tradeName || null,
          cnpj: storeCnpj(createForm.cnpj),
          ie: createForm.ie || null,
          im: createForm.im || null,
          street: createForm.street || null,
          city: createForm.city.trim(),
          state: createForm.state.trim(),
          cep: storeCep(createForm.cep),
          phone: storePhone(createForm.phone),
          email: createForm.email || null,
        }),
      });
      setShowCreate(false);
      setCreateForm(emptyCreate());
      setMessage(`${t.branchesPage.createBranch}: ${created.code}`);
      await load(created.id);
    } catch (err) {
      setError(apiErrorMessage(err, t.error));
    } finally {
      setBusy('');
    }
  };

  const deleteBranch = async () => {
    if (!branch || !master) return;
    setBusy('delete');
    setMessage('');
    setError('');
    try {
      await api<{ ok: boolean }>(`/branches/${branch.id}`, { method: 'DELETE' });
      setMessage(`${t.branchesPage.deleteBranch}: ${branch.code}`);
      setConfirmOpen(false);
      setSelectedId('');
      setBranch(null);
      await load();
    } catch (err) {
      setError(
        `${t.branchesPage.deleteBlocked}: ${apiErrorMessage(err, t.error)}`,
      );
    } finally {
      setBusy('');
    }
  };

  return (
    <AppShell>
      <PageHeader title={t.branchesPage.title} subtitle={t.branchesPage.subtitle} />
      {error ? <p className="error-msg">{error}</p> : null}
      {!isAdmin ? <p className="muted">{t.branchesPage.adminOnly}</p> : null}
      {message ? <p className="ok-msg">{message}</p> : null}

      <div
        className="actions"
        style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}
      >
        {isAdmin ? (
          <button
            type="button"
            className="primary"
            onClick={() => {
              setShowCreate((v) => !v);
              if (!showCreate) setShowOrg(false);
              setError('');
            }}
          >
            {showCreate ? t.branchesPage.cancel : t.branchesPage.addBranch}
          </button>
        ) : null}
        <button
          type="button"
          className="ghost"
          onClick={() => setShowOrg((v) => !v)}
        >
          {showOrg ? t.branchesPage.hideOrg : t.branchesPage.showOrg}
        </button>
      </div>

      {showOrg ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{t.branchesPage.orgTitle}</h2>
          <p className="muted">{t.branchesPage.orgHelp}</p>
          {org ? (
            <>
              <div className="form-grid">
                <Field
                  label={t.branchesPage.legalName}
                  value={org.name}
                  disabled={!isAdmin}
                  onChange={(v) => setOrg({ ...org, name: v })}
                />
                <Field
                  label={t.branchesPage.tradeName}
                  value={org.tradeName ?? ''}
                  disabled={!isAdmin}
                  onChange={(v) => setOrg({ ...org, tradeName: v })}
                />
                <Field
                  label={t.branchesPage.cnpj}
                  value={org.cnpj}
                  disabled={!isAdmin}
                  format={formatCnpj}
                  onChange={(v) => setOrg({ ...org, cnpj: v })}
                />
                <Field
                  label={t.branchesPage.ie}
                  value={org.ie ?? ''}
                  disabled={!isAdmin}
                  onChange={(v) => setOrg({ ...org, ie: v })}
                />
                <Field
                  label={t.branchesPage.im}
                  value={org.im ?? ''}
                  disabled={!isAdmin}
                  onChange={(v) => setOrg({ ...org, im: v })}
                />
                <Field
                  label={t.branchesPage.street}
                  value={org.street ?? ''}
                  disabled={!isAdmin}
                  onChange={(v) => setOrg({ ...org, street: v })}
                />
                <Field
                  label={t.branchesPage.city}
                  value={org.city ?? ''}
                  disabled={!isAdmin}
                  onChange={(v) => setOrg({ ...org, city: v })}
                />
                <Field
                  label={t.branchesPage.state}
                  value={org.state ?? ''}
                  disabled={!isAdmin}
                  onChange={(v) =>
                    setOrg({ ...org, state: v.toUpperCase().slice(0, 2) })
                  }
                />
                <Field
                  label={t.branchesPage.cep}
                  value={org.cep ?? ''}
                  disabled={!isAdmin}
                  format={formatCep}
                  onChange={(v) => setOrg({ ...org, cep: v })}
                />
                <Field
                  label={t.branchesPage.phone}
                  value={org.phone ?? ''}
                  disabled={!isAdmin}
                  format={formatPhoneBr}
                  onChange={(v) => setOrg({ ...org, phone: v })}
                />
                <Field
                  label={t.branchesPage.email}
                  value={org.email ?? ''}
                  disabled={!isAdmin}
                  onChange={(v) => setOrg({ ...org, email: v })}
                />
              </div>
              {isAdmin ? (
                <div className="actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={busy === 'org'}
                    onClick={saveOrg}
                  >
                    {t.branchesPage.save}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">{t.loading}</p>
          )}
        </section>
      ) : null}

      {isAdmin && showCreate ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{t.branchesPage.addBranch}</h2>
          <p className="muted">{t.branchesPage.requiredHint}</p>
          <div className="form-grid">
            <Field
              label={t.branchesPage.code}
              value={createForm.code}
              onChange={(v) =>
                setCreateForm({ ...createForm, code: v.toUpperCase() })
              }
            />
            <Field
              label={t.branchesPage.siteName}
              value={createForm.name}
              onChange={(v) => setCreateForm({ ...createForm, name: v })}
            />
            <Field
              label={t.branchesPage.legalName}
              value={createForm.legalName}
              onChange={(v) => setCreateForm({ ...createForm, legalName: v })}
            />
            <Field
              label={t.branchesPage.tradeName}
              value={createForm.tradeName}
              onChange={(v) => setCreateForm({ ...createForm, tradeName: v })}
            />
            <Field
              label={t.branchesPage.cnpj}
              value={createForm.cnpj}
              format={formatCnpj}
              onChange={(v) => setCreateForm({ ...createForm, cnpj: v })}
            />
            <Field
              label={t.branchesPage.ie}
              value={createForm.ie}
              onChange={(v) => setCreateForm({ ...createForm, ie: v })}
            />
            <Field
              label={t.branchesPage.im}
              value={createForm.im}
              onChange={(v) => setCreateForm({ ...createForm, im: v })}
            />
            <Field
              label={t.branchesPage.street}
              value={createForm.street}
              onChange={(v) => setCreateForm({ ...createForm, street: v })}
            />
            <Field
              label={t.branchesPage.city}
              value={createForm.city}
              onChange={(v) => setCreateForm({ ...createForm, city: v })}
            />
            <Field
              label={t.branchesPage.state}
              value={createForm.state}
              onChange={(v) =>
                setCreateForm({
                  ...createForm,
                  state: v.toUpperCase().slice(0, 2),
                })
              }
            />
            <Field
              label={t.branchesPage.cep}
              value={createForm.cep}
              format={formatCep}
              onChange={(v) => setCreateForm({ ...createForm, cep: v })}
            />
            <Field
              label={t.branchesPage.phone}
              value={createForm.phone}
              format={formatPhoneBr}
              onChange={(v) => setCreateForm({ ...createForm, phone: v })}
            />
            <Field
              label={t.branchesPage.email}
              value={createForm.email}
              onChange={(v) => setCreateForm({ ...createForm, email: v })}
            />
          </div>
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy === 'create'}
              onClick={createBranch}
            >
              {t.branchesPage.createBranch}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>{t.branchesPage.selectBranch}</h2>
        <ul className="branch-list">
          {branches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={b.id === selectedId ? 'nav-link active' : 'nav-link'}
                onClick={() => selectBranch(b.id)}
              >
                <strong>{b.code}</strong> — {b.name}
                <div className="muted">
                  {b.cnpj || '—'} · {t.branchesPage.equipmentCount}:{' '}
                  {b._count?.equipment ?? 0}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {branch ? (
        <section className="panel detail-panel" style={{ marginTop: '1rem' }}>
          <div className="detail-head">
            <h2>
              {t.branchesPage.branchTitle}: {branch.code}
            </h2>
            <button type="button" className="ghost" onClick={closeBranchDetail}>
              {t.branchesPage.close}
            </button>
          </div>
          <div className="form-grid">
            <Field
              label={t.branchesPage.code}
              value={branch.code}
              disabled
              onChange={() => undefined}
            />
            <Field
              label={t.branchesPage.siteName}
              value={branch.name}
              disabled={!isAdmin}
              onChange={(v) => setBranch({ ...branch, name: v })}
            />
            <Field
              label={t.branchesPage.legalName}
              value={branch.legalName ?? ''}
              disabled={!isAdmin}
              onChange={(v) => setBranch({ ...branch, legalName: v })}
            />
            <Field
              label={t.branchesPage.tradeName}
              value={branch.tradeName ?? ''}
              disabled={!isAdmin}
              onChange={(v) => setBranch({ ...branch, tradeName: v })}
            />
            <Field
              label={t.branchesPage.cnpj}
              value={branch.cnpj ?? ''}
              disabled={!isAdmin}
              format={formatCnpj}
              onChange={(v) => setBranch({ ...branch, cnpj: v })}
            />
            <Field
              label={t.branchesPage.ie}
              value={branch.ie ?? ''}
              disabled={!isAdmin}
              onChange={(v) => setBranch({ ...branch, ie: v })}
            />
            <Field
              label={t.branchesPage.im}
              value={branch.im ?? ''}
              disabled={!isAdmin}
              onChange={(v) => setBranch({ ...branch, im: v })}
            />
            <Field
              label={t.branchesPage.street}
              value={branch.street ?? ''}
              disabled={!isAdmin}
              onChange={(v) => setBranch({ ...branch, street: v })}
            />
            <Field
              label={t.branchesPage.city}
              value={branch.city}
              disabled={!isAdmin}
              onChange={(v) => setBranch({ ...branch, city: v })}
            />
            <Field
              label={t.branchesPage.state}
              value={branch.state}
              disabled={!isAdmin}
              onChange={(v) =>
                setBranch({
                  ...branch,
                  state: v.toUpperCase().slice(0, 2),
                })
              }
            />
            <Field
              label={t.branchesPage.cep}
              value={branch.cep ?? ''}
              disabled={!isAdmin}
              format={formatCep}
              onChange={(v) => setBranch({ ...branch, cep: v })}
            />
            <Field
              label={t.branchesPage.phone}
              value={branch.phone ?? ''}
              disabled={!isAdmin}
              format={formatPhoneBr}
              onChange={(v) => setBranch({ ...branch, phone: v })}
            />
            <Field
              label={t.branchesPage.email}
              value={branch.email ?? ''}
              disabled={!isAdmin}
              onChange={(v) => setBranch({ ...branch, email: v })}
            />
          </div>
          {isAdmin ? (
            <div className="actions">
              <button
                type="button"
                className="primary"
                disabled={busy === 'branch'}
                onClick={saveBranch}
              >
                {t.branchesPage.save}
              </button>
              {master ? (
                <button
                  type="button"
                  className="ghost danger-btn"
                  disabled={busy === 'delete'}
                  onClick={() => setConfirmOpen(true)}
                >
                  {t.branchesPage.deleteBranch}
                </button>
              ) : null}
            </div>
          ) : null}
          {isAdmin && !master ? (
            <p className="muted">{t.branchesPage.masterOnlyDelete}</p>
          ) : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmOpen && Boolean(branch)}
        title={t.masterDelete.title}
        entityLabel={branch ? `${branch.code} — ${branch.name}` : ''}
        message={t.masterDelete.branchMsg}
        confirmLabel={t.branchesPage.deleteBranch}
        cancelLabel={t.masterDelete.cancel}
        busy={busy === 'delete'}
        onConfirm={deleteBranch}
        onCancel={() => setConfirmOpen(false)}
      />
    </AppShell>
  );
}
