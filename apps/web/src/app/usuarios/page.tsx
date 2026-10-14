'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api, getUserRole } from '@/lib/api';
import { formatPhoneBr, storePhone } from '@/lib/brFormat';

type Role =
  | 'ADMIN'
  | 'COMMERCIAL'
  | 'OPERATIONS'
  | 'FINANCE'
  | 'MAINTENANCE'
  | 'READ_ONLY';

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
  role: Role;
  active: boolean;
};

type UserForm = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  password: string;
  role: Role;
  active: boolean;
};

const emptyForm = (): UserForm => ({
  name: '',
  email: '',
  phone: '',
  whatsapp: '',
  password: '',
  role: 'COMMERCIAL',
  active: true,
});

const ROLES: Role[] = [
  'ADMIN',
  'COMMERCIAL',
  'OPERATIONS',
  'FINANCE',
  'MAINTENANCE',
  'READ_ONLY',
];

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

export default function UsersPage() {
  const { t } = useLocale();
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const load = async () => {
    try {
      const data = await api<UserRow[]>('/users');
      setRows(data);
    } catch (err) {
      setError(apiError(err, t.error));
    }
  };

  useEffect(() => {
    const admin = getUserRole() === 'ADMIN';
    setIsAdmin(admin);
    if (admin) load();
  }, [t.error]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowCreate(true);
    setError('');
    setMessage('');
  };

  const openEdit = (u: UserRow) => {
    setShowCreate(false);
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone ? formatPhoneBr(u.phone) : '',
      whatsapp: u.whatsapp ? formatPhoneBr(u.whatsapp) : '',
      password: '',
      role: u.role,
      active: u.active,
    });
    setError('');
    setMessage('');
  };

  const payload = () => ({
    name: form.name.trim(),
    email: form.email.trim(),
    phone: storePhone(form.phone),
    whatsapp: storePhone(form.whatsapp) || storePhone(form.phone),
    role: form.role,
    active: form.active,
    ...(form.password.trim() ? { password: form.password.trim() } : {}),
  });

  const createUser = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await api<UserRow>('/users', {
        method: 'POST',
        body: JSON.stringify({ ...payload(), password: form.password.trim() }),
      });
      setShowCreate(false);
      setForm(emptyForm());
      setMessage(`${t.usersPage.created}: ${created.name}`);
      await load();
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy(false);
    }
  };

  const saveUser = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await api<UserRow>(`/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload()),
      });
      setEditing(null);
      setMessage(`${t.usersPage.updated}: ${updated.name}`);
      await load();
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppShell>
        <PageHeader title={t.usersPage.title} subtitle={t.usersPage.subtitle} />
        <p className="muted">{t.usersPage.adminOnly}</p>
      </AppShell>
    );
  }

  const formFields = (
    <>
      <div className="form-grid">
        <label className="field">
          <span>{t.usersPage.name}</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="field">
          <span>{t.usersPage.email}</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="field">
          <span>{t.usersPage.phone}</span>
          <input
            value={form.phone}
            onChange={(e) =>
              setForm({ ...form, phone: formatPhoneBr(e.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>{t.usersPage.whatsapp}</span>
          <input
            value={form.whatsapp}
            onChange={(e) =>
              setForm({ ...form, whatsapp: formatPhoneBr(e.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>{t.usersPage.role}</span>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t.usersPage.roles[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t.usersPage.status}</span>
          <select
            value={form.active ? '1' : '0'}
            onChange={(e) =>
              setForm({ ...form, active: e.target.value === '1' })
            }
          >
            <option value="1">{t.usersPage.active}</option>
            <option value="0">{t.usersPage.inactive}</option>
          </select>
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>{t.usersPage.password}</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
          />
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {t.usersPage.passwordHint}
          </span>
        </label>
      </div>
    </>
  );

  return (
    <AppShell>
      <PageHeader title={t.usersPage.title} subtitle={t.usersPage.subtitle} />
      {error ? <p className="error-msg">{error}</p> : null}
      {message ? <p className="ok-msg">{message}</p> : null}

      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (showCreate) setShowCreate(false);
            else openCreate();
          }}
        >
          {showCreate ? t.usersPage.cancel : t.usersPage.add}
        </button>
      </div>

      {showCreate ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{t.usersPage.add}</h2>
          {formFields}
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={
                busy ||
                !form.name.trim() ||
                !form.email.trim() ||
                form.password.trim().length < 6
              }
              onClick={createUser}
            >
              {t.usersPage.create}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <DataTable
          headers={[
            t.usersPage.name,
            t.usersPage.email,
            t.usersPage.phone,
            t.usersPage.whatsapp,
            t.usersPage.role,
            t.usersPage.status,
            t.customers.actions,
          ]}
          empty={t.empty}
          rows={rows.map((u) => [
            u.name,
            u.email,
            u.phone || '—',
            u.whatsapp || '—',
            t.usersPage.roles[u.role] ?? u.role,
            u.active ? t.usersPage.active : t.usersPage.inactive,
            <button
              key="e"
              type="button"
              className="ghost"
              onClick={() => openEdit(u)}
            >
              {t.usersPage.edit}
            </button>,
          ])}
        />
      </section>

      {editing ? (
        <section className="panel detail-panel" style={{ marginTop: '1rem' }}>
          <div className="detail-head">
            <h2>
              {t.usersPage.edit}: {editing.name}
            </h2>
            <button
              type="button"
              className="ghost"
              onClick={() => setEditing(null)}
            >
              {t.usersPage.close}
            </button>
          </div>
          {formFields}
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy || !form.name.trim() || !form.email.trim()}
              onClick={saveUser}
            >
              {t.usersPage.save}
            </button>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
