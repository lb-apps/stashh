'use client';

import * as React from 'react';

const optValue = (o: { value?: string } | string): string =>
  typeof o === 'string' ? o : (o.value ?? '');
const optLabel = (o: { label?: React.ReactNode; value?: string } | string): React.ReactNode =>
  typeof o === 'string' ? o : (o.label ?? o.value);


export type SegmentedOption = string | { value: string; label?: React.ReactNode };

type SegmentedControlProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style' | 'onChange'> & {
  options?: SegmentedOption[];
  value?: string;
  onChange?: (next: string) => void;
  onWhite?: boolean;
  style?: React.CSSProperties;
};

export function SegmentedControl({ options = [], value, onChange, onWhite = false, style, ...rest }: SegmentedControlProps) {
  const idx = Math.max(0, options.findIndex((o) => optValue(o) === value));
  const n = options.length || 1;
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: `repeat(${n}, 1fr)`,
        height: 56,
        padding: 5,
        borderRadius: 'var(--r-field)',
        background: onWhite ? 'var(--surface-field-on-white)' : 'var(--surface-field)',
        boxShadow: 'inset 0 1px 3px rgba(28,25,20,0.06)',
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          position: 'absolute',
          top: 5,
          left: `calc(5px + ${idx} * ((100% - 10px) / ${n}))`,
          width: `calc((100% - 10px) / ${n})`,
          height: 'calc(100% - 10px)',
          borderRadius: 'calc(var(--r-field) - 5px)',
          background: 'var(--white)',
          boxShadow: 'var(--sh-thumb), var(--gloss-top-strong)',
          transition: 'left var(--dur) var(--ease-spring)',
        }}
      />
      {options.map((o) => {
        const v = optValue(o);
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange && onChange(v)}
            style={{
              position: 'relative',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-body)',
              fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
              letterSpacing: 'var(--tr-tight)',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'color var(--dur-fast) var(--ease-out)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {optLabel(o)}
          </button>
        );
      })}
    </div>
  );
}
