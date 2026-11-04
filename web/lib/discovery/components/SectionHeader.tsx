'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Glyph } from './Glyph';
import { TEXT_SECONDARY_STRONG, TITLE_3 } from '../pending-tokens';
import { BUTTON_RESET, usePressable } from '../use-pressable';

/** The bold "see all" chevron: larger and heavier than a row chevron, by the design's call. */
const CHEVRON = { size: 21, stroke: 3 } as const;

type SectionHeaderProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style' | 'title' | 'children'> & {
  title: React.ReactNode;
  /** Trailing grey count ("145 spots"). */
  meta?: React.ReactNode;
  /** Heading level for the page outline. */
  as?: 'h2' | 'h3';
  style?: React.CSSProperties;
};

/**
 * A home section's heading: heavy display title, and a trailing grey count.
 * With `onClick` the whole row is one button and a bold chevron follows the
 * title; without it the row is plain text.
 */
export function SectionHeader({ title, meta, as: Heading = 'h2', onClick, style, ...rest }: SectionHeaderProps) {
  const press = usePressable<HTMLButtonElement>(rest);
  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--sp-6)',
    width: '100%',
    minHeight: 'var(--hit-min)',
  };
  const content = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            ...TITLE_3,
            fontWeight: 'var(--fw-heavy)',
            letterSpacing: 'var(--tr-title)',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {onClick ? <Glyph icon={ChevronRight} size={CHEVRON.size} strokeWidth={CHEVRON.stroke} color="var(--grey-600)" /> : null}
      </span>
      {meta != null ? (
        <span
          style={{
            flex: '0 0 auto',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--fs-caption)',
            lineHeight: 'var(--lh-caption)',
            fontWeight: 'var(--fw-semibold)',
            color: TEXT_SECONDARY_STRONG,
          }}
        >
          {meta}
        </span>
      ) : null}
    </>
  );

  return (
    <Heading style={{ margin: 0, font: 'inherit', ...style }}>
      {onClick ? (
        <button type="button" onClick={onClick} {...rest} {...press.handlers} style={{ ...BUTTON_RESET, ...row, ...press.style }}>
          {content}
        </button>
      ) : (
        <span style={row}>{content}</span>
      )}
    </Heading>
  );
}
