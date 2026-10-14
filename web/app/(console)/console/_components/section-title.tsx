import { MicroLabel } from "@/lib/discovery";

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
      {/* grey-800, not the default tertiary: grey-500 on bone is ~2:1. */}
      <MicroLabel as="h2" style={{ color: "var(--grey-800)" }}>
        {children}
      </MicroLabel>
      {trailing ? (
        <span className="font-mono text-micro tabular-nums text-grey-800">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}
