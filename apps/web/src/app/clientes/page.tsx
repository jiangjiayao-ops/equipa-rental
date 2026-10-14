'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/i18n/LocaleProvider';
import { api } from '@/lib/api';
import {
  formatCep,
  formatCpfOrCnpj,
  formatPhoneBr,
  storeCep,
  storeCpfOrCnpj,
  storePhone,
} from '@/lib/brFormat';

type Customer = {
  id: string;
  legalName: string;
  tradeName?: string | null;
  document: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  createdAt?: string;
  contacts?: Array<{ name: string; email?: string | null; phone?: string | null }>;
  sites?: Array<{ address: string; city: string; state: string }>;
  _count: { contracts: number; proposals: number };
};

type CustomerForm = {
  legalName: string;
  tradeName: string;
  document: string;
  contactName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  cep: string;
};

type SortKey = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc';

const SORT_STORAGE_KEY = 'equipa_customers_sort';
const SORT_KEYS: SortKey[] = ['newest', 'oldest', 'nameAsc', 'nameDesc'];

const emptyForm = (): CustomerForm => ({
  legalName: '',
  tradeName: '',
  document: '',
  contactName: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  cep: '',
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

function readStoredSort(): SortKey {
  if (typeof window === 'undefined') return 'newest';
  const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
  if (raw && SORT_KEYS.includes(raw as SortKey)) return raw as SortKey;
  return 'newest';
}

function sortCustomers(list: Customer[], sort: SortKey): Customer[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (sort === 'nameAsc' || sort === 'nameDesc') {
      const cmp = a.legalName.localeCompare(b.legalName, undefined, {
        sensitivity: 'base',
      });
      return sort === 'nameAsc' ? cmp : -cmp;
    }
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return sort === 'oldest' ? ta - tb : tb - ta;
  });
  return copy;
}

function parseSite(site?: { address: string; city: string; state: string }) {
  if (!site) return { street: '', cep: '', city: '', state: '' };
  const cepMatch = site.address.match(/CEP\s*([0-9.-]+)/i);
  const street = site.address.replace(/\s*·\s*CEP\s*[0-9.-]+/i, '').trim();
  return {
    street,
    cep: cepMatch ? formatCep(cepMatch[1]) : '',
    city: site.city || '',
    state: site.state || '',
  };
}

function formFromCustomer(c: Customer): CustomerForm {
  const site = parseSite(c.sites?.[0]);
  return {
    legalName: c.legalName || '',
    tradeName: c.tradeName || '',
    document: formatCpfOrCnpj(c.document) || c.document || '',
    contactName: c.contacts?.[0]?.name || '',
    email: c.email || '',
    phone: c.phone ? formatPhoneBr(c.phone) : '',
    street: site.street,
    city: site.city || c.city || '',
    state: site.state || c.state || '',
    cep: site.cep,
  };
}

function payloadFromForm(form: CustomerForm) {
  return {
    legalName: form.legalName.trim(),
    tradeName: form.tradeName.trim() || undefined,
    document: storeCpfOrCnpj(form.document) || form.document,
    documentType:
      (form.document.replace(/\D/g, '').length || 0) <= 11 ? 'CPF' : 'CNPJ',
    email: form.email.trim() || null,
    phone: storePhone(form.phone),
    contactName: form.contactName.trim() || null,
    street: form.street.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim().toUpperCase() || null,
    cep: storeCep(form.cep),
  };
}

export default function CustomersPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState<Customer[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [sort, setSort] = useState<SortKey>('newest');

  useEffect(() => {
    setSort(readStoredSort());
  }, []);

  const load = async () => {
    try {
      const data = await api<Customer[]>('/customers');
      setRows(data);
    } catch {
      setError(t.error);
    }
  };

  useEffect(() => {
    load();
  }, [t.error]);

  const sortedRows = useMemo(() => sortCustomers(rows, sort), [rows, sort]);

  const changeSort = (next: SortKey) => {
    setSort(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SORT_STORAGE_KEY, next);
    }
  };

  const openCreate = () => {
    setSelected(null);
    setEditing(false);
    setShowCreate(true);
    setForm(emptyForm());
    setError('');
    setMessage('');
  };

  const openCustomer = async (id: string) => {
    setShowCreate(false);
    setEditing(false);
    setError('');
    setMessage('');
    try {
      const full = await api<Customer>(`/customers/${id}`);
      setSelected(full);
      setForm(formFromCustomer(full));
    } catch (err) {
      setError(apiError(err, t.error));
    }
  };

  const createCustomer = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await api<Customer>('/customers', {
        method: 'POST',
        body: JSON.stringify(payloadFromForm(form)),
      });
      setForm(emptyForm());
      setShowCreate(false);
      setMessage(`${t.customers.created}: ${created.legalName}`);
      await load();
      await openCustomer(created.id);
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy(false);
    }
  };

  const saveCustomer = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await api<Customer>(`/customers/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payloadFromForm(form)),
      });
      setSelected(updated);
      setForm(formFromCustomer(updated));
      setEditing(false);
      setMessage(`${t.customers.updated}: ${updated.legalName}`);
      await load();
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy(false);
    }
  };

  const openNewProposal = (customerId: string) => {
    router.push(`/propostas?customerId=${encodeURIComponent(customerId)}&new=1`);
  };

  const formFields = (disabled: boolean) => (
    <div className="form-grid">
      <label className="field">
        <span>{t.customers.legalName}</span>
        <input
          value={form.legalName}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, legalName: e.target.value })}
          required
        />
      </label>
      <label className="field">
        <span>{t.customers.tradeName}</span>
        <input
          value={form.tradeName}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.customers.document}</span>
        <input
          value={form.document}
          disabled={disabled}
          onChange={(e) =>
            setForm({ ...form, document: formatCpfOrCnpj(e.target.value) })
          }
          placeholder="00.000.000/0000-00"
          required
        />
      </label>
      <label className="field">
        <span>{t.customers.contactName}</span>
        <input
          value={form.contactName}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.email}</span>
        <input
          type="email"
          value={form.email}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.customers.phoneWhatsapp}</span>
        <input
          value={form.phone}
          disabled={disabled}
          onChange={(e) =>
            setForm({ ...form, phone: formatPhoneBr(e.target.value) })
          }
          placeholder="(11) 98765-4321"
        />
      </label>
      <label className="field" style={{ gridColumn: '1 / -1' }}>
        <span>{t.customers.street}</span>
        <input
          value={form.street}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, street: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.customers.city}</span>
        <input
          value={form.city}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t.customers.state}</span>
        <input
          value={form.state}
          maxLength={2}
          disabled={disabled}
          onChange={(e) =>
            setForm({
              ...form,
              state: e.target.value.toUpperCase().slice(0, 2),
            })
          }
          placeholder="SP"
        />
      </label>
      <label className="field">
        <span>{t.customers.cep}</span>
        <input
          value={form.cep}
          disabled={disabled}
          onChange={(e) =>
            setForm({ ...form, cep: formatCep(e.target.value) })
          }
          placeholder="00000-000"
        />
      </label>
    </div>
  );

  return (
    <AppShell>
      <PageHeader title={t.customers.title} subtitle={t.customers.subtitle} />
      <p className="muted" style={{ marginTop: '-0.6rem' }}>
        {t.customers.createHint}
      </p>
      {error ? <p className="error-msg">{error}</p> : null}
      {message ? <p className="ok-msg">{message}</p> : null}

      <div
        className="actions"
        style={{
          marginBottom: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'end',
        }}
      >
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
          {showCreate ? t.customers.cancel : t.customers.addCustomer}
        </button>
        <label className="field" style={{ margin: 0, minWidth: 200 }}>
          <span>{t.customers.sort}</span>
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value as SortKey)}
          >
            <option value="newest">{t.customers.sortNewest}</option>
            <option value="oldest">{t.customers.sortOldest}</option>
            <option value="nameAsc">{t.customers.sortNameAsc}</option>
            <option value="nameDesc">{t.customers.sortNameDesc}</option>
          </select>
        </label>
      </div>

      {showCreate ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{t.customers.addCustomer}</h2>
          {formFields(false)}
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={
                busy || !form.legalName.trim() || !form.document.replace(/\D/g, '')
              }
              onClick={createCustomer}
            >
              {t.customers.create}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <DataTable
          headers={[
            t.proposals.customer,
            t.customers.document,
            t.email,
            t.customers.phoneWhatsapp,
            t.customers.city,
            t.customers.contracts,
            t.customers.actions,
          ]}
          empty={t.empty}
          rows={sortedRows.map((c) => [
            <button
              type="button"
              className="linkish"
              key="name"
              onClick={() => openCustomer(c.id)}
            >
              {c.legalName}
            </button>,
            formatCpfOrCnpj(c.document) || c.document,
            c.email || '—',
            c.phone || '—',
            [c.city, c.state].filter(Boolean).join(' / ') || '—',
            String(c._count.contracts),
            <div key="a" className="actions" style={{ margin: 0, gap: '0.4rem' }}>
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  await openCustomer(c.id);
                  setEditing(true);
                }}
              >
                {t.customers.edit}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => openNewProposal(c.id)}
              >
                {t.customers.newProposal}
              </button>
            </div>,
          ])}
        />
      </section>

      {selected ? (
        <section className="panel detail-panel" style={{ marginTop: '1rem' }}>
          <div className="detail-head">
            <h2>
              {t.customers.detail}: {selected.legalName}
            </h2>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setSelected(null);
                setEditing(false);
              }}
            >
              {t.customers.close}
            </button>
          </div>
          {editing ? (
            <>
              {formFields(false)}
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  disabled={
                    busy ||
                    !form.legalName.trim() ||
                    !form.document.replace(/\D/g, '')
                  }
                  onClick={saveCustomer}
                >
                  {t.customers.save}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setForm(formFromCustomer(selected));
                    setEditing(false);
                  }}
                >
                  {t.customers.cancel}
                </button>
              </div>
            </>
          ) : (
            <>
              {formFields(true)}
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => setEditing(true)}
                >
                  {t.customers.edit}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => openNewProposal(selected.id)}
                >
                  {t.customers.newProposal}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
