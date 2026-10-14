'use client';

import * as React from 'react';

type DialogProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style' | 'title'> & {
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  style?: React.CSSProperties;
};

export function Dialog({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Not now', destructive = false, onConfirm, onCancel, style, ...rest }: DialogProps) {
  const btn = (label: React.ReactNode, kind: string, onPress?: () => void) => (
    <button
      type="button"
      onClick={onPress}
      style={{
        flex: 1,
        height: 52,
        border: 'none',
        borderRadius: 'var(--r-pill)',
        background: 'var(--surface-field)',
        color: kind === 'destructive' ? 'var(--text-danger)' : 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-label)',
        fontWeight: 'var(--fw-bold)',
        letterSpacing: 'var(--tr-tight)',
        boxShadow: 'var(--gloss-top)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
  return (
    <div
      role="alertdialog"
      style={{
        width: 340,
        padding: 24,
        borderRadius: 'var(--r-card-lg)',
        background: 'var(--bone-50)',
        boxShadow: 'var(--sh-card-lg)',
        ...style,
      }}
      {...rest}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-headline)', lineHeight: 'var(--lh-headline)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--tr-tight)', color: 'var(--text-primary)' }}>
        {title}
      </div>
      {body ? (
        <div style={{ marginTop: 8, fontFamily: 'var(--font-text)', fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-body-lg)', color: 'var(--text-secondary)' }}>{body}</div>
      ) : null}
      <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
        {btn(confirmLabel, destructive ? 'destructive' : 'default', onConfirm)}
        {btn(cancelLabel, 'default', onCancel)}
      </div>
    </div>
  );
}
