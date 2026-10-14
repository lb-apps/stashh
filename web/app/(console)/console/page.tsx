import { requireConsole } from "@/lib/console-gate";
import { RecognitionConsole } from "./_components/recognition-console";

export default async function ConsolePage() {
  await requireConsole();
  return <RecognitionConsole />;
}
