import { SessionGate } from "../_components/session-gate";
import { MapApp } from "../_features/shell/map-app";

export default function AppPage() {
  return (
    <SessionGate>
      <MapApp />
    </SessionGate>
  );
}
