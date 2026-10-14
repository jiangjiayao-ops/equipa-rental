'use client';

import { useEffect, useState } from 'react';
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
  contacts?: Array<{ name: string; email?: string | null; phone?: string | null }>;
  sites?: Array<{ address: string; city: string; state: string }>;
  _count: { contracts: number; proposals: number };
};

type CreateForm = {
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

const emptyForm = (): CreateForm => ({
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

export default function CustomersPage() {
  const { t } = useLocale();
  const [rows, setRows] = useState<Customer[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);

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

  const createCustomer = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await api<Customer>('/customers', {
        method: 'POST',
        body: JSON.stringify({
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
        }),
      });
      setForm(emptyForm());
      setShowCreate(false);
      setMessage(`${t.customers.created}: ${created.legalName}`);
      await load();
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title={t.customers.title} subtitle={t.customers.subtitle} />
      <p className="muted" style={{ marginTop: '-0.6rem' }}>
        {t.customers.createHint}
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
          {showCreate ? t.customers.cancel : t.customers.addCustomer}
        </button>
      </div>

      {showCreate ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{t.customers.addCustomer}</h2>
          <div className="form-grid">
            <label className="field">
              <span>{t.customers.legalName}</span>
              <input
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>{t.customers.tradeName}</span>
              <input
                value={form.tradeName}
                onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t.customers.document}</span>
              <input
                value={form.document}
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
                onChange={(e) =>
                  setForm({ ...form, contactName: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>{t.email}</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t.customers.phoneWhatsapp}</span>
              <input
                value={form.phone}
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
                onChange={(e) => setForm({ ...form, street: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t.customers.city}</span>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t.customers.state}</span>
              <input
                value={form.state}
                maxLength={2}
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
                onChange={(e) =>
                  setForm({ ...form, cep: formatCep(e.target.value) })
                }
                placeholder="00000-000"
              />
            </label>
          </div>
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
          ]}
          empty={t.empty}
          rows={rows.map((c) => [
            c.legalName,
            formatCpfOrCnpj(c.document) || c.document,
            c.email || '—',
            c.phone || '—',
            [c.city, c.state].filter(Boolean).join(' / ') || '—',
            String(c._count.contracts),
          ])}
        />
      </section>
    </AppShell>
  );
}
