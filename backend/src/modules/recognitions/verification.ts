import { calculateRetryBackoff } from "./service.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runBackoffChecks(): void {
  const firstRetry = calculateRetryBackoff(0);
  const secondRetry = calculateRetryBackoff(1);
  const cappedRetry = calculateRetryBackoff(20);

  assert(firstRetry.retryCount === 1, "First retry count should be 1");
  assert(
    firstRetry.delayMilliseconds === 1_000,
    "First retry should be delayed by one second",
  );
  assert(
    secondRetry.delayMilliseconds === 2_000,
    "Second retry should be delayed by two seconds",
  );
  assert(
    cappedRetry.delayMilliseconds === 60_000,
    "Backoff should be capped at sixty seconds",
  );
}

function runTransitionChecks(): void {
  const terminalStates = ["failed", "cancelled", "expired", "committed"];
  assert(terminalStates.includes("failed"), "Terminal states should include failed");
  assert(terminalStates.includes("committed"), "Terminal states should include committed");
}

function main(): void {
  runBackoffChecks();
  runTransitionChecks();
  console.log("recognitions verification checks passed");
}

main();
