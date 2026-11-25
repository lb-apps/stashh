"use client";

import { CircleAlert, CircleCheck, Minus, Plus } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useChangeCredits, useSetPlan } from "@/hooks/use-billing";
import { useNow } from "@/hooks/use-now";
import { CREDIT_CHANGE_MAX, type BillingPerson, type BillingStatus, type Plan } from "@/lib/billing-types";
import { DASH, formatDateTime, formatInt, formatRelative } from "@/lib/format";
import { BILLING_TASK, PLAN, PLAN_SOURCE, personLabel } from "@/lib/labels";
import { StatGrid } from "./stat-grid";

/** One person's plan and credits, opened from the people search as a side sheet. */
export function BillingPersonSheet({ person, open, onClose }: { person: BillingPerson | null; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open && person !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <ScrollArea className="h-full">
          {/* Keyed by person, so a half-typed change never carries over to someone else. */}
          {person && <PersonBody key={person.user_id} person={person} />}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/** A titled block of the sheet; `htmlFor` makes the title the visible label of the block's field. */
function Section({ label, id, htmlFor, children }: { label: string; id?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 id={id} className="micro-label">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="micro-label">
            {label}
          </Label>
        ) : (
          label
        )}
      </h3>
      {children}
    </section>
  );
}

const plural = (count: number, one: string, many: string) => `${formatInt(count)} ${count === 1 ? one : many}`;

function PersonBody({ person }: { person: BillingPerson }) {
  const { status } = person;
  const now = useNow();
  const name = personLabel(person.username, person.user_id);

  return (
    <div className="grid gap-8 p-6 pr-12">
      <SheetHeader className="gap-1 p-0">
        <SheetTitle className="text-headline font-black">{name}</SheetTitle>
        <SheetDescription className="flex flex-wrap gap-x-2">
          {person.display_name && <span>{person.display_name}</span>}
          <span className="font-mono text-[13px] break-all">{person.user_id}</span>
        </SheetDescription>
      </SheetHeader>

      <StatGrid
        size="md"
        className="grid-cols-2 sm:grid-cols-2"
        stats={[
          { label: "Plan", value: PLAN[status.plan].label },
          { label: "Credits", value: formatInt(status.credits) },
          { label: "Last 24 hours", value: `${formatInt(status.used_today)} of ${formatInt(status.daily_limit)}` },
          {
            label: "Next free",
            value: status.used_today < status.daily_limit ? "Now" : status.next_free_at ? formatRelative(status.next_free_at, now) : DASH,
          },
        ]}
      />

      <CreditsForm person={person} name={name} />
      <PlanForm person={person} />

      {status.tasks.length > 0 && (
        <Section label="Tasks">
          <ItemGroup className="gap-2">
            {status.tasks.map((task) => (
              <Item key={task.task} role="listitem" variant="muted" size="sm" className="px-3.5 py-2.5">
                <ItemContent>
                  <ItemTitle>{BILLING_TASK[task.task]}</ItemTitle>
                </ItemContent>
                <ItemActions className="gap-3">
                  <span className="text-caption text-muted-foreground tabular-nums">{plural(task.credits, "credit", "credits")}</span>
                  <Badge variant={task.done ? "success" : "secondary"}>{task.done ? "Done" : "Not yet"}</Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </Section>
      )}
    </div>
  );
}

/** Add or remove credits; a removal asks once more before it applies. */
function CreditsForm({ person, name }: { person: BillingPerson; name: string }) {
  const id = useId();
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const change = useChangeCredits();
  const held = person.status.credits;
  const value = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(value) && value >= 1 && value <= CREDIT_CHANGE_MAX;
  const canRemove = valid && value <= held;

  const apply = (delta: number) =>
    // A new id per submit: the hook's retries reuse it, so a lost answer never applies twice.
    change.mutate(
      { userId: person.user_id, delta, requestId: crypto.randomUUID() },
      {
        onSuccess: () => {
          setConfirming(false);
          setAmount("");
        },
      },
    );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (valid && !change.isPending) apply(value);
  };

  const done = change.isSuccess ? { delta: change.variables.delta, held: change.data.credits } : null;

  return (
    <Section label="Credits to add or remove" htmlFor={id}>
      <form onSubmit={submit} className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            max={CREDIT_CHANGE_MAX}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setConfirming(false);
              change.reset();
            }}
            className="w-28"
            aria-invalid={(amount.trim() !== "" && !valid) || undefined}
            aria-describedby={`${id}-help`}
          />
          <Button type="submit" disabled={!valid || change.isPending}>
            <Plus aria-hidden />
            Add
          </Button>
          <Button type="button" variant="destructive" disabled={!canRemove || change.isPending || confirming} onClick={() => setConfirming(true)}>
            <Minus aria-hidden />
            Remove
          </Button>
        </div>
        <p id={`${id}-help`} className="text-caption text-muted-foreground">
          1 to {formatInt(CREDIT_CHANGE_MAX)} at a time; a removal takes at most the {plural(held, "credit", "credits")} they hold.
        </p>
      </form>

      {confirming && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>
            Remove {plural(value, "credit", "credits")} from {name}?
          </AlertTitle>
          <AlertDescription>
            <p>
              They hold {formatInt(held)}; {formatInt(held - value)} will be left.
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Focus lands on the safe choice. */}
              <Button type="button" size="sm" variant="secondary" autoFocus onClick={() => setConfirming(false)}>
                Keep them
              </Button>
              <Button type="button" size="sm" variant="destructive" disabled={change.isPending} onClick={() => apply(-value)}>
                {change.isPending ? "Removing…" : `Remove ${plural(value, "credit", "credits")}`}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {change.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Credits not changed</AlertTitle>
          <AlertDescription>{change.error.message}</AlertDescription>
        </Alert>
      )}
      {done && (
        <Alert>
          <CircleCheck />
          <AlertTitle>{done.delta > 0 ? `Added ${plural(done.delta, "credit", "credits")}` : `Removed ${plural(-done.delta, "credit", "credits")}`}</AlertTitle>
          <AlertDescription>They hold {formatInt(done.held)} now.</AlertDescription>
        </Alert>
      )}
    </Section>
  );
}

/** An instant as the date field shows it, in local time: "2026-12-03"; empty for none. */
function toDateField(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The last second of that local day, as the backend takes an end date. */
function endOfDay(field: string): string {
  const [year = 0, month = 1, day = 1] = field.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

function planLine(status: BillingStatus): string {
  const source = `${PLAN_SOURCE[status.plan_source]}${status.store ? ` (${status.store})` : ""}`;
  if (status.plan === "free") return `Free · ${source}`;
  return `Premium ${status.plan_expires_at ? `until ${formatDateTime(status.plan_expires_at)}` : "until changed"} · ${source}`;
}

/** Free or Premium, with an optional last day for Premium. */
function PlanForm({ person }: { person: BillingPerson }) {
  const ids = { plan: useId(), ends: useId() };
  const { status } = person;
  const [plan, setPlanDraft] = useState<Plan>(status.plan);
  const [ends, setEnds] = useState(() => toDateField(status.plan_expires_at));
  const save = useSetPlan();
  const now = useNow();
  const today = toDateField(new Date(now).toISOString());
  const dirty = plan !== status.plan || (plan === "premium" && ends !== toDateField(status.plan_expires_at));
  const endsInvalid = plan === "premium" && ends !== "" && ends < today;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || endsInvalid) return;
    save.mutate({ userId: person.user_id, plan, expiresAt: plan === "premium" && ends ? endOfDay(ends) : null });
  };

  return (
    <Section label="Plan" id={ids.plan}>
      <form onSubmit={submit} className="grid gap-4">
        <p className="text-caption text-muted-foreground">Now: {planLine(status)}</p>
        <ToggleGroup
          type="single"
          variant="segmented"
          value={plan}
          onValueChange={(value) => {
            if (!value) return;
            setPlanDraft(value as Plan);
            save.reset();
          }}
          aria-labelledby={ids.plan}
        >
          <ToggleGroupItem value="free">{PLAN.free.label}</ToggleGroupItem>
          <ToggleGroupItem value="premium">{PLAN.premium.label}</ToggleGroupItem>
        </ToggleGroup>

        {plan === "premium" && (
          <div className="grid gap-1.5">
            <Label htmlFor={ids.ends} className="text-caption font-semibold">
              Last day
            </Label>
            <Input
              id={ids.ends}
              type="date"
              min={today}
              value={ends}
              onChange={(event) => {
                setEnds(event.target.value);
                save.reset();
              }}
              className="w-48"
              aria-invalid={endsInvalid || undefined}
              aria-describedby={`${ids.ends}-help`}
            />
            <p id={`${ids.ends}-help`} className="text-caption text-muted-foreground">
              Premium ends after that day. Leave it empty to keep Premium until you change it.
            </p>
          </div>
        )}

        {save.error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Plan not set</AlertTitle>
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
        {save.isSuccess && !dirty && (
          <Alert>
            <CircleCheck />
            <AlertTitle>Plan set</AlertTitle>
            <AlertDescription>It applies to their next analysis.</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || endsInvalid || save.isPending}>
            {save.isPending ? "Saving…" : "Set plan"}
          </Button>
        </div>
      </form>
    </Section>
  );
}
