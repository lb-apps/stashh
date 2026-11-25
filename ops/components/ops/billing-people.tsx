"use client";

import { CircleAlert, Search, UserSearch } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBillingPeople } from "@/hooks/use-billing";
import type { BillingPerson } from "@/lib/billing-types";
import { formatInt } from "@/lib/format";
import { PLAN, personLabel } from "@/lib/labels";
import { BillingPersonSheet } from "./billing-person-sheet";
import { EmptyState } from "./states";

/** What the owner typed, as the backend matches it: a handle without its "@". */
const searchTerm = (text: string) => text.trim().replace(/^@/, "");

/** Find a person by Instagram username or user id; one opens in a side sheet to change their credits or plan. */
export function BillingPeople() {
  const inputId = useId();
  const [text, setText] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  // The open person stays set while the sheet closes, so its content does not vanish mid-animation.
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const people = useBillingPeople(query);
  const term = searchTerm(text);
  const person = people.data?.items.find((item) => item.user_id === openId) ?? null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (term.length < 2) return;
    // The same search again asks again: someone's credits may have moved since.
    if (term === query) void people.refetch();
    else setQuery(term);
  };

  const open = (userId: string) => {
    setOpenId(userId);
    setSheetOpen(true);
  };

  return (
    <div className="grid gap-5">
      <form role="search" onSubmit={submit} className="grid gap-2">
        <Label htmlFor={inputId} className="micro-label">
          Instagram username or user id
        </Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="@username"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby={`${inputId}-help`}
          />
          <Button type="submit" variant="secondary" disabled={term.length < 2 || term.length > 100}>
            <Search aria-hidden />
            Find
          </Button>
        </div>
        <p id={`${inputId}-help`} className="text-caption text-muted-foreground">
          Any part of a username, at least 2 characters, or a whole user id.
        </p>
      </form>

      {query !== null && <Results query={query} people={people} selectedId={sheetOpen ? openId : null} onOpen={open} />}

      <BillingPersonSheet person={person} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

function Results({
  query,
  people,
  selectedId,
  onOpen,
}: {
  query: string;
  people: ReturnType<typeof useBillingPeople>;
  selectedId: string | null;
  onOpen: (userId: string) => void;
}) {
  if (people.error) {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Could not search</AlertTitle>
        <AlertDescription>{people.error.message}</AlertDescription>
      </Alert>
    );
  }
  if (!people.data) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (people.data.items.length === 0) return <EmptyState icon={<UserSearch />} title={`Nobody matches “${query}”`} />;
  return <PeopleTable people={people.data.items} selectedId={selectedId} onOpen={onOpen} />;
}

function PeopleTable({ people, selectedId, onOpen }: { people: BillingPerson[]; selectedId: string | null; onOpen: (userId: string) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead className="text-right">Credits</TableHead>
          <TableHead className="text-right">Last 24 hours</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => {
          const name = personLabel(person.username, person.user_id);
          const plan = PLAN[person.status.plan];
          return (
            <TableRow
              key={person.user_id}
              className="cursor-pointer"
              data-state={person.user_id === selectedId ? "selected" : undefined}
              tabIndex={0}
              aria-label={`Open ${name}'s plan and credits`}
              onClick={() => onOpen(person.user_id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(person.user_id);
                }
              }}
            >
              <TableCell className="max-w-64">
                <span className="block truncate font-semibold">{name}</span>
                {person.display_name && <span className="block truncate text-muted-foreground">{person.display_name}</span>}
              </TableCell>
              <TableCell>
                <Badge variant={plan.variant}>{plan.label}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatInt(person.status.credits)}</TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {formatInt(person.status.used_today)} of {formatInt(person.status.daily_limit)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
