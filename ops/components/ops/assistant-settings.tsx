"use client";

import { CircleAlert, CircleCheck, RotateCcw } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAssistantSettings, useSaveAssistantSettings } from "@/hooks/use-assistant-settings";
import { formatDateTime, formatInt } from "@/lib/format";
import { ASSISTANT_MODELS, type AssistantSettings, type AssistantSettingsPatch } from "@/lib/ops-types";
import { ServiceError } from "./states";

/** Loads the settings and hands them to the form; a save remounts the form on the new row. */
export function AssistantSettingsPanel() {
  const { data, error } = useAssistantSettings();
  if (error) return <ServiceError error={error} />;
  if (!data) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  return <SettingsForm key={data.updated_at ?? "default"} settings={data} />;
}

type Draft = {
  model: string;
  prompt: string;
  usesDefaultPrompt: boolean;
  maxSteps: string;
  dailyTurnCap: string;
  suggestedReplies: boolean;
  enabled: boolean;
};

function draftOf(settings: AssistantSettings): Draft {
  return {
    model: settings.model,
    prompt: settings.system_prompt ?? settings.default_prompt,
    usesDefaultPrompt: settings.system_prompt === null,
    maxSteps: String(settings.max_steps),
    dailyTurnCap: String(settings.daily_turn_cap),
    suggestedReplies: settings.suggested_replies,
    enabled: settings.enabled,
  };
}

/** What changed, as the backend takes it; nothing when the draft equals the saved row. */
function patchOf(draft: Draft, settings: AssistantSettings): AssistantSettingsPatch {
  const patch: AssistantSettingsPatch = {};
  if (draft.model !== settings.model) patch.model = draft.model;
  const prompt = draft.usesDefaultPrompt || draft.prompt.trim() === settings.default_prompt.trim() ? null : draft.prompt;
  if (prompt !== settings.system_prompt) patch.system_prompt = prompt;
  const maxSteps = Number(draft.maxSteps);
  if (Number.isInteger(maxSteps) && maxSteps !== settings.max_steps) patch.max_steps = maxSteps;
  const cap = Number(draft.dailyTurnCap);
  if (Number.isInteger(cap) && cap !== settings.daily_turn_cap) patch.daily_turn_cap = cap;
  if (draft.suggestedReplies !== settings.suggested_replies) patch.suggested_replies = draft.suggestedReplies;
  if (draft.enabled !== settings.enabled) patch.enabled = draft.enabled;
  return patch;
}

function SettingsForm({ settings }: { settings: AssistantSettings }) {
  const ids = { model: useId(), prompt: useId(), steps: useId(), cap: useId(), suggested: useId(), enabled: useId() };
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings));
  const save = useSaveAssistantSettings();
  const patch = patchOf(draft, settings);
  const dirty = Object.keys(patch).length > 0;
  const steps = Number(draft.maxSteps);
  const cap = Number(draft.dailyTurnCap);
  const stepsInvalid = !Number.isInteger(steps) || steps < 1 || steps > 12;
  const capInvalid = !Number.isInteger(cap) || cap < 1 || cap > 10_000;
  const promptInvalid = !draft.usesDefaultPrompt && draft.prompt.trim().length === 0;
  const invalid = stepsInvalid || capInvalid || promptInvalid;
  const update = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || invalid) return;
    save.mutate(patch);
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Switch id={ids.enabled} checked={draft.enabled} onCheckedChange={(enabled) => update({ enabled })} />
          <Label htmlFor={ids.enabled} className="text-caption font-semibold">
            {draft.enabled ? "Answering" : "Paused: a fixed line goes out, no model is called"}
          </Label>
        </div>
        {settings.updated_at && <span className="text-caption text-muted-foreground">Saved {formatDateTime(settings.updated_at)}</span>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={ids.model} className="micro-label">
          Model
        </Label>
        <Select value={draft.model} onValueChange={(model) => update({ model })}>
          <SelectTrigger id={ids.model} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSISTANT_MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
                <span className="text-muted-foreground"> · {model.detail}</span>
              </SelectItem>
            ))}
            {!ASSISTANT_MODELS.some((model) => model.id === draft.model) && <SelectItem value={draft.model}>{draft.model}</SelectItem>}
          </SelectContent>
        </Select>
        <p className="text-caption text-muted-foreground">Both take the forced tool choice the assistant relies on; Opus and Sonnet 5.5 refuse it.</p>
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={ids.prompt} className="micro-label">
            System prompt {draft.usesDefaultPrompt ? "· the shipped one" : "· yours"}
          </Label>
          {!draft.usesDefaultPrompt && (
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => update({ prompt: settings.default_prompt, usesDefaultPrompt: true })}>
              <RotateCcw aria-hidden />
              Back to the shipped prompt
            </Button>
          )}
        </div>
        <Textarea
          id={ids.prompt}
          value={draft.prompt}
          onChange={(event) => update({ prompt: event.target.value, usesDefaultPrompt: false })}
          spellCheck={false}
          className="max-h-[60vh] min-h-64 font-mono text-[13px] leading-5"
          aria-invalid={promptInvalid || undefined}
          aria-describedby={`${ids.prompt}-help`}
        />
        <p id={`${ids.prompt}-help`} className="text-caption text-muted-foreground">
          English instructions, Markdown headings; {formatInt(draft.prompt.length)} characters. The live account block and the person&apos;s message follow it on every turn.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={ids.steps} className="micro-label">
            Model calls per turn
          </Label>
          <Input id={ids.steps} type="number" inputMode="numeric" min={1} max={12} value={draft.maxSteps} onChange={(event) => update({ maxSteps: event.target.value })} aria-invalid={stepsInvalid || undefined} />
          <p className="text-caption text-muted-foreground">1 to 12; past it a fixed line goes out.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={ids.cap} className="micro-label">
            Turns per person per day
          </Label>
          <Input id={ids.cap} type="number" inputMode="numeric" min={1} max={10000} value={draft.dailyTurnCap} onChange={(event) => update({ dailyTurnCap: event.target.value })} aria-invalid={capInvalid || undefined} />
          <p className="text-caption text-muted-foreground">Above it the person gets a fixed line until tomorrow.</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <Switch id={ids.suggested} checked={draft.suggestedReplies} onCheckedChange={(suggestedReplies) => update({ suggestedReplies })} />
        <Label htmlFor={ids.suggested} className="text-caption font-semibold">
          Next-step quick replies under answers
        </Label>
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
          <AlertDescription>The next turn runs with these settings.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
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
