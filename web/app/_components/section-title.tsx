/** Shared heading — keeps vertical rhythm identical across every panel. */
export function SectionTitle({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-[13px] font-medium text-foreground/70">
        {children}
      </h2>
      {trailing ? (
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}
