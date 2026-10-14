import "server-only";

import { notFound } from "next/navigation";
import { connection } from "next/server";

/**
 * The recognition console (`/console` and its `/api/*` proxies) is an internal
 * dev tool: it mints backend dev tokens and calls the API on the server's
 * behalf. stashh.me is public, so in a production build the console does not
 * exist unless `STASHH_CONSOLE_ENABLED=true` is set at runtime.
 */
function isConsoleEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.STASHH_CONSOLE_ENABLED === "true"
  );
}

/**
 * For the console page. `connection()` keeps the check at request time — a
 * statically prerendered page would bake in the build machine's env instead.
 */
export async function requireConsole(): Promise<void> {
  await connection();
  if (!isConsoleEnabled()) notFound();
}

/** For route handlers: answers a bare 404 while the console is off. */
export function withConsoleGate<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) =>
    isConsoleEnabled() ? handler(...args) : new Response(null, { status: 404 });
}
