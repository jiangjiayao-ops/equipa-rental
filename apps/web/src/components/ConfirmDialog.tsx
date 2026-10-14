'use client';

import { ReactNode } from 'react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  entityLabel: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  danger?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Master-admin confirmation modal — shows entity name/number before destructive action. */
export function ConfirmDialog({
  open,
  title,
  entityLabel,
  message,
  confirmLabel,
  cancelLabel,
  busy,
  danger = true,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p className="confirm-entity">
          <strong>{entityLabel}</strong>
        </p>
        <p className="muted">{message}</p>
        {children}
        <div className="actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className={danger ? 'primary danger-btn' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? '…' : confirmLabel}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
