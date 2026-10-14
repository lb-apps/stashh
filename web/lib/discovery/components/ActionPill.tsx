'use client';

import * as React from 'react';

type ActionPillProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style'> & {
  icon?: React.ReactNode;
  tone?: 'neutral' | 'open' | 'cobalt';
  onBone?: boolean;
  style?: React.CSSProperties;
};

export function ActionPill({
  children,
  icon = null,
  tone = 'neutral',
  onBone = false,
  onClick,
  style,
  ...rest
}: ActionPillProps) {
  const [pressed, setPressed] = React.useState(false);
  const tones: Record<string, React.CSSProperties> = {
    neutral: {
      background: onBone ? 'var(--surface-field)' : 'var(--surface-field-on-white)',
      color: 'var(--text-primary)',
    },
    open: { background: 'var(--green-100)', color: 'var(--text-open)' },
    cobalt: { background: 'var(--cobalt-50)', color: 'var(--cobalt-500)' },
  };
  const interactive = typeof onClick === 'function';
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => interactive && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 46,
        padding: '0 22px 0 18px',
        border: 'none',
        borderRadius: 'var(--r-pill)',
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-body)',
        fontWeight: 'var(--fw-semibold)',
        letterSpacing: 'var(--tr-tight)',
        boxShadow: 'var(--gloss-top)',
        cursor: interactive ? 'pointer' : 'default',
        transform: pressed ? 'scale(var(--press-scale))' : 'scale(1)',
        transition: 'transform var(--dur-fast) var(--ease-spring)',
        WebkitTapHighlightColor: 'transparent',
        ...(tones[tone] || tones.neutral),
        ...style,
      }}
      {...rest}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
