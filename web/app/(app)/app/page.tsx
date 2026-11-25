import { SessionGate } from "../_components/session-gate";
import { entrySheet } from "../_features/shell/entry";
import { MapApp } from "../_features/shell/map-app";

export default async function AppPage({ searchParams }: PageProps<"/app">) {
  const { sheet } = await searchParams;
  return (
    <SessionGate>
      <MapApp entry={entrySheet(sheet)} />
    </SessionGate>
  );
}
