'use client';

import * as React from 'react';
import { TEXT_DANGER_STRONG, TEXT_SECONDARY_STRONG } from '../pending-tokens';

/** The dialog's width, padding, and its button row. */
const DIALOG_W = 340;
const DIALOG_PAD = 24;
const BUTTON_H = 52;
const BUTTON_GAP = 12;
const BODY_GAP = 8;
const ACTIONS_GAP = 22;

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

/**
 * Discovery's alert: a title, one line of body, confirm and cancel. Cancel —
 * the safe answer — has focus when it opens. The caller owns the modal layer
 * (scrim, Escape, inert page).
 */
export function Dialog({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Not now', destructive = false, onConfirm, onCancel, style, ...rest }: DialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  // Focus is a DOM side effect of opening, once.
  React.useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const btn = (label: React.ReactNode, kind: 'default' | 'destructive', onPress?: () => void, ref?: React.Ref<HTMLButtonElement>) => (
    <button
      ref={ref}
      type="button"
      onClick={onPress}
      style={{
        flex: 1,
        height: BUTTON_H,
        border: 'none',
        borderRadius: 'var(--r-pill)',
        background: 'var(--surface-field)',
        color: kind === 'destructive' ? TEXT_DANGER_STRONG : 'var(--text-primary)',
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
        width: DIALOG_W,
        padding: DIALOG_PAD,
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
        <div style={{ marginTop: BODY_GAP, fontFamily: 'var(--font-text)', fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-body-lg)', color: TEXT_SECONDARY_STRONG }}>{body}</div>
      ) : null}
      <div style={{ display: 'flex', gap: BUTTON_GAP, marginTop: ACTIONS_GAP }}>
        {btn(confirmLabel, destructive ? 'destructive' : 'default', onConfirm)}
        {btn(cancelLabel, 'default', onCancel, cancelRef)}
      </div>
    </div>
  );
}
