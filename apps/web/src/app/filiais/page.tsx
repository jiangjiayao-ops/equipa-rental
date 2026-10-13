'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, getUserRole } from '@/lib/api';

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
  _count?: { equipment: number };
};

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function BranchesPage() {
  const { t } = useLocale();
  const [isAdmin, setIsAdmin] = useState(false);
  const [org, setOrg] = useState<OrgForm | null>(null);
  const [branches, setBranches] = useState<BranchForm[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [branch, setBranch] = useState<BranchForm | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    setError('');
    try {
      const [orgRes, branchRes] = await Promise.all([
        api<OrgForm>('/organization'),
        api<BranchForm[]>('/branches'),
      ]);
      setOrg(orgRes);
      setBranches(branchRes);
      const nextId = selectedId || branchRes[0]?.id || '';
      setSelectedId(nextId);
      const match = branchRes.find((b) => b.id === nextId) ?? branchRes[0] ?? null;
      setBranch(match);
    } catch {
      setError(t.error);
    }
  };

  useEffect(() => {
    setIsAdmin(getUserRole() === 'ADMIN');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.error]);

  const selectBranch = (id: string) => {
    setSelectedId(id);
    setBranch(branches.find((b) => b.id === id) ?? null);
    setMessage('');
  };

  const saveOrg = async () => {
    if (!org || !isAdmin) return;
    setBusy('org');
    setMessage('');
    try {
      const updated = await api<OrgForm>('/organization', {
        method: 'PATCH',
        body: JSON.stringify({
          name: org.name,
          tradeName: org.tradeName || null,
          cnpj: org.cnpj,
          ie: org.ie || null,
          im: org.im || null,
          street: org.street || null,
          city: org.city || null,
          state: org.state || null,
          cep: org.cep || null,
          phone: org.phone || null,
          email: org.email || null,
        }),
      });
      setOrg(updated);
      setMessage(t.saved);
    } catch {
      setError(t.error);
    } finally {
      setBusy('');
    }
  };

  const saveBranch = async () => {
    if (!branch || !isAdmin) return;
    setBusy('branch');
    setMessage('');
    try {
      const updated = await api<BranchForm>(`/branches/${branch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: branch.name,
          legalName: branch.legalName || null,
          tradeName: branch.tradeName || null,
          cnpj: branch.cnpj || null,
          ie: branch.ie || null,
          im: branch.im || null,
          street: branch.street || null,
          city: branch.city,
          state: branch.state,
          cep: branch.cep || null,
          phone: branch.phone || null,
          email: branch.email || null,
        }),
      });
      setBranch(updated);
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
      setMessage(t.saved);
    } catch {
      setError(t.error);
    } finally {
      setBusy('');
    }
  };

  return (
    <AppShell>
      <PageHeader title={t.branchesPage.title} subtitle={t.branchesPage.subtitle} />
      {error ? <p className="muted">{error}</p> : null}
      {!isAdmin ? <p className="muted">{t.branchesPage.adminOnly}</p> : null}
      {message ? <p className="ok-msg">{message}</p> : null}

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
                onChange={(v) => setOrg({ ...org, state: v })}
              />
              <Field
                label={t.branchesPage.cep}
                value={org.cep ?? ''}
                disabled={!isAdmin}
                onChange={(v) => setOrg({ ...org, cep: v })}
              />
              <Field
                label={t.branchesPage.phone}
                value={org.phone ?? ''}
                disabled={!isAdmin}
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

      <div className="split">
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

        <section className="panel">
          <h2>
            {t.branchesPage.branchTitle}
            {branch ? `: ${branch.code}` : ''}
          </h2>
          {branch ? (
            <>
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
                  onChange={(v) => setBranch({ ...branch, state: v })}
                />
                <Field
                  label={t.branchesPage.cep}
                  value={branch.cep ?? ''}
                  disabled={!isAdmin}
                  onChange={(v) => setBranch({ ...branch, cep: v })}
                />
                <Field
                  label={t.branchesPage.phone}
                  value={branch.phone ?? ''}
                  disabled={!isAdmin}
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
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">{t.loading}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
