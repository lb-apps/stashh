// Secrets are not in wrangler.jsonc, so `wrangler types` cannot see them. Set with
// `npx wrangler secret put <NAME> --env production` (in workers/hooks/); locally in
// workers/hooks/.dev.vars (copy .dev.vars.example).
interface Env {
  /** Signs Instagram webhooks: the Instagram app's secret ("API setup with Instagram login"). */
  INSTAGRAM_APP_SECRET?: string;
  /** Seals the envelope; the same value as every instance's HOOKS_RELAY_SECRET. */
  HOOKS_RELAY_SECRET: string;
}
