'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { useLocale } from '@/i18n/LocaleProvider';
import { ThemeSwitcher } from '@/theme/ThemeSwitcher';
import { formatBrl, publicApi } from '@/lib/api';
import { whatsappDeepLink } from '@/lib/whatsapp';

type Option = {
  id: string;
  label: string;
  billingPeriod: string;
  durationDays: number;
  unitRate: number;
  mobFee: number;
  demobFee: number;
  selected?: boolean;
};

type PublicProposal = {
  id: string;
  number: string;
  status: string;
  notes?: string | null;
  validUntil?: string | null;
  billingTiming: string;
  allowedHours?: number;
  hoursUnlimited?: boolean;
  customer: { legalName: string };
  branch: { code: string; name: string };
  owner?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
  } | null;
  lines: Array<{ description: string; quantity: number }>;
  options: Option[];
  contracts?: Array<{ number: string; status: string }>;
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

export default function PublicProposalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { t, locale } = useLocale();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [optionId, setOptionId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [contractNumber, setContractNumber] = useState('');

  useEffect(() => {
    if (!token) return;
    publicApi<PublicProposal>(`/public/proposals/${token}`)
      .then((p) => {
        setProposal(p);
        setOptionId(p.options[0]?.id ?? '');
        if (p.contracts?.[0]) setContractNumber(p.contracts[0].number);
      })
      .catch((err) => setError(apiError(err, t.error)));
  }, [token, t.error]);

  const accept = async () => {
    if (!token || !optionId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await publicApi<{
        proposal: PublicProposal;
        contract: { number: string };
      }>(`/public/proposals/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({ optionId }),
      });
      setProposal(res.proposal);
      setContractNumber(res.contract.number);
      setMessage(
        `${t.publicProposal.accepted} · ${t.publicProposal.contractCreated}: ${res.contract.number}`,
      );
    } catch (err) {
      setError(apiError(err, t.error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ width: 'min(720px, 100%)' }}>
        <div className="row" style={{ marginTop: 0 }}>
          <div>
            <h1 className="brand">{t.brand}</h1>
            <p className="tagline">{t.publicProposal.title}</p>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="ok-msg">{message}</p> : null}

        {!proposal ? (
          <p className="muted">{t.publicProposal.loading}</p>
        ) : (
          <>
            <p>
              <strong>{proposal.number}</strong> · {proposal.customer.legalName}
              <br />
              <span className="muted">
                {proposal.branch.code} · {proposal.branch.name}
              </span>
              <br />
              <span>
                {t.publicProposal.allowedHours}:{' '}
                {proposal.hoursUnlimited
                  ? t.publicProposal.hoursUnlimited
                  : proposal.allowedHours ?? 200}
              </span>
            </p>
            <p className="muted">{t.publicProposal.subtitle}</p>

            {proposal.owner ? (
              <section style={{ marginBottom: '1rem' }}>
                <h3>{t.publicProposal.contactBlock}</h3>
                <p>
                  <strong>{proposal.owner.name}</strong>
                  {proposal.owner.phone ? (
                    <>
                      <br />
                      {t.publicProposal.phone}: {proposal.owner.phone}
                    </>
                  ) : null}
                </p>
                <div className="actions" style={{ marginTop: '0.4rem' }}>
                  {proposal.owner.email ? (
                    <a
                      className="ghost"
                      href={`mailto:${proposal.owner.email}?subject=${encodeURIComponent(proposal.number)}`}
                    >
                      {t.publicProposal.emailLink}
                    </a>
                  ) : null}
                  {whatsappDeepLink(
                    proposal.owner.whatsapp || proposal.owner.phone,
                    proposal.number,
                    locale === 'en' ? 'en' : 'pt-BR',
                  ) ? (
                    <a
                      className="ghost"
                      href={
                        whatsappDeepLink(
                          proposal.owner.whatsapp || proposal.owner.phone,
                          proposal.number,
                          locale === 'en' ? 'en' : 'pt-BR',
                        )!
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.publicProposal.openWhatsApp}
                    </a>
                  ) : null}
                </div>
              </section>
            ) : null}

            {proposal.status === 'EXPIRED' ? (
              <p className="error">{t.publicProposal.expired}</p>
            ) : null}

            <h3>{t.publicProposal.equipment}</h3>
            <ul>
              {proposal.lines.map((l, i) => (
                <li key={i}>
                  {l.description}
                  {l.quantity > 1 ? ` × ${l.quantity}` : ''}
                </li>
              ))}
            </ul>

            <h3>{t.publicProposal.selectOption}</h3>
            <div className="period-sections">
              {proposal.options.map((o) => {
                const active = optionId === o.id;
                return (
                  <button
                    type="button"
                    key={o.id}
                    className={`period-card selectable${active ? ' selected' : ''}`}
                    disabled={
                      proposal.status === 'ACCEPTED' ||
                      proposal.status === 'EXPIRED'
                    }
                    onClick={() => setOptionId(o.id)}
                  >
                    <header className="period-card-head">
                      <span className="period-badge">{o.label}</span>
                      <strong>
                        {o.durationDays} {t.publicProposal.days} ·{' '}
                        {t.status[o.billingPeriod as keyof typeof t.status] ??
                          o.billingPeriod}
                      </strong>
                    </header>
                    <p className="period-rate">
                      {t.publicProposal.packageRate}:{' '}
                      <strong>{formatBrl(o.unitRate)}</strong>
                    </p>
                    {(o.mobFee || o.demobFee) > 0 ? (
                      <p className="muted">
                        mob {formatBrl(o.mobFee)} / demob {formatBrl(o.demobFee)}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {proposal.notes ? <p className="muted">{proposal.notes}</p> : null}

            {proposal.status === 'ACCEPTED' ? (
              <p className="ok-msg">
                {t.publicProposal.accepted}
                {contractNumber
                  ? ` · ${t.publicProposal.contractCreated}: ${contractNumber}`
                  : ''}
              </p>
            ) : (
              <button
                type="button"
                className="primary"
                style={{ width: '100%', marginTop: '1rem' }}
                disabled={busy || !optionId || proposal.status === 'EXPIRED'}
                onClick={accept}
              >
                {t.publicProposal.accept}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
