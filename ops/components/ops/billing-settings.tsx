"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBillingSettings, useSaveBillingSettings } from "@/hooks/use-billing";
import { DAILY_ANALYSES_MAX, TASK_CREDITS_MAX, type BillingSettings, type BillingSettingsPatch } from "@/lib/billing-types";
import { formatDateTime, formatInt } from "@/lib/format";
import { ServiceError } from "./states";

/**
 * Loads the settings and hands them to the form; a save remounts the form on the new row.
 * The save lives here, above that remount, so its outcome stays on screen after it.
 */
export function BillingSettingsPanel() {
  const { data, error } = useBillingSettings();
  const save = useSaveBillingSettings();
  if (error) return <ServiceError error={error} />;
  if (!data) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    );
  }
  return <SettingsForm key={data.updated_at} settings={data} save={save} />;
}

type NumberField = "free_daily_analyses" | "premium_daily_analyses" | "first_list_credits" | "first_web_visit_credits";
type Draft = Record<NumberField, string> & { mock_purchases: boolean };

const NUMBER_FIELDS: NumberField[] = ["free_daily_analyses", "premium_daily_analyses", "first_list_credits", "first_web_visit_credits"];

function draftOf(settings: BillingSettings): Draft {
  return {
    free_daily_analyses: String(settings.free_daily_analyses),
    premium_daily_analyses: String(settings.premium_daily_analyses),
    first_list_credits: String(settings.first_list_credits),
    first_web_visit_credits: String(settings.first_web_visit_credits),
    mock_purchases: settings.mock_purchases,
  };
}

/** A whole number from 0 to `max`, or null. */
function bounded(value: string, max: number): number | null {
  const number = Number(value);
  return value.trim() !== "" && Number.isInteger(number) && number >= 0 && number <= max ? number : null;
}

/** What changed, as the backend takes it; nothing when the draft equals the saved row. */
function patchOf(draft: Draft, settings: BillingSettings): BillingSettingsPatch {
  const patch: BillingSettingsPatch = {};
  for (const field of NUMBER_FIELDS) {
    const number = Number(draft[field]);
    if (Number.isInteger(number) && number !== settings[field]) patch[field] = number;
  }
  if (draft.mock_purchases !== settings.mock_purchases) patch.mock_purchases = draft.mock_purchases;
  return patch;
}

function SettingsForm({ settings, save }: { settings: BillingSettings; save: ReturnType<typeof useSaveBillingSettings> }) {
  const ids = { analyses: useId(), free: useId(), premium: useId(), tasks: useId(), list: useId(), visit: useId(), mock: useId() };
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings));
  const patch = patchOf(draft, settings);
  const dirty = Object.keys(patch).length > 0;

  const free = bounded(draft.free_daily_analyses, DAILY_ANALYSES_MAX);
  const premium = bounded(draft.premium_daily_analyses, DAILY_ANALYSES_MAX);
  const premiumInvalid = premium === null || (free !== null && premium < free);
  const listInvalid = bounded(draft.first_list_credits, TASK_CREDITS_MAX) === null;
  const visitInvalid = bounded(draft.first_web_visit_credits, TASK_CREDITS_MAX) === null;
  const invalid = free === null || premiumInvalid || listInvalid || visitInvalid;
  const update = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || invalid) return;
    save.mutate(patch);
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div role="group" aria-labelledby={ids.analyses} className="grid gap-2">
        <span id={ids.analyses} className="micro-label">
          Analyses a day
        </span>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={ids.free} className="text-caption font-semibold">
              Free
            </Label>
            <Input
              id={ids.free}
              type="number"
              inputMode="numeric"
              min={0}
              max={DAILY_ANALYSES_MAX}
              value={draft.free_daily_analyses}
              onChange={(event) => update({ free_daily_analyses: event.target.value })}
              aria-invalid={free === null || undefined}
              aria-describedby={`${ids.analyses}-help`}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.premium} className="text-caption font-semibold">
              Premium
            </Label>
            <Input
              id={ids.premium}
              type="number"
              inputMode="numeric"
              min={0}
              max={DAILY_ANALYSES_MAX}
              value={draft.premium_daily_analyses}
              onChange={(event) => update({ premium_daily_analyses: event.target.value })}
              aria-invalid={premiumInvalid || undefined}
              aria-describedby={`${ids.analyses}-help`}
            />
          </div>
        </div>
        <p id={`${ids.analyses}-help`} className="text-caption text-muted-foreground">
          Per rolling 24 hours, before credits are spent. 0 to {formatInt(DAILY_ANALYSES_MAX)}; Premium at least Free.
        </p>
      </div>

      <div role="group" aria-labelledby={ids.tasks} className="grid gap-2">
        <span id={ids.tasks} className="micro-label">
          Credits for a task
        </span>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={ids.list} className="text-caption font-semibold">
              First list
            </Label>
            <Input
              id={ids.list}
              type="number"
              inputMode="numeric"
              min={0}
              max={TASK_CREDITS_MAX}
              value={draft.first_list_credits}
              onChange={(event) => update({ first_list_credits: event.target.value })}
              aria-invalid={listInvalid || undefined}
              aria-describedby={`${ids.tasks}-help`}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.visit} className="text-caption font-semibold">
              First web visit
            </Label>
            <Input
              id={ids.visit}
              type="number"
              inputMode="numeric"
              min={0}
              max={TASK_CREDITS_MAX}
              value={draft.first_web_visit_credits}
              onChange={(event) => update({ first_web_visit_credits: event.target.value })}
              aria-invalid={visitInvalid || undefined}
              aria-describedby={`${ids.tasks}-help`}
            />
          </div>
        </div>
        <p id={`${ids.tasks}-help`} className="text-caption text-muted-foreground">
          Given once per person. 0 to {formatInt(TASK_CREDITS_MAX)}; 0 turns the reward off.
        </p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2.5">
          <Switch id={ids.mock} checked={draft.mock_purchases} onCheckedChange={(mock_purchases) => update({ mock_purchases })} aria-describedby={`${ids.mock}-help`} />
          <Label htmlFor={ids.mock} className="text-caption font-semibold">
            Paywall grants Premium for free
          </Label>
        </div>
        <p id={`${ids.mock}-help`} className="text-caption text-muted-foreground">
          For testing only: anyone who buys on the web gets Premium without paying.
        </p>
      </div>

      {save.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{save.error.message}</AlertDescription>
        </Alert>
      )}
      {save.isSuccess && !dirty && (
        <Alert>
          <CircleCheck />
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>The next analysis runs with these settings.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-caption text-muted-foreground">Saved {formatDateTime(settings.updated_at)}</span>
        <Button type="button" variant="secondary" disabled={!dirty || save.isPending} onClick={() => setDraft(draftOf(settings))}>
          Discard
        </Button>
        <Button type="submit" disabled={!dirty || invalid || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
