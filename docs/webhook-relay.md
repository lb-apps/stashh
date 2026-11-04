# The webhook relay (`hooks.stashh.me`) and `/env`

Meta gives an app one webhook callback per product. Stashh has one Meta app and one Instagram
account (@stashh.me), and no test app or tester accounts by design. So production and a developer's
Mac cannot each get their own callback.

The callback is `https://hooks.stashh.me/meta/instagram` instead: a Cloudflare Worker
([`workers/hooks/`](../workers/hooks)) that sends **each sender** to exactly one environment.

- Everyone goes to **prod**.
- A person who sends `/env dev` from their own Instagram account goes to the developer's Mac, and
  only that person, until they send `/env prod`.

Nothing is copied. Two instances never answer the same person, and a real user's messages never
leave production. This is how dev testing works with one Meta app.

## Addresses

```
Given to Meta (permanent):
  https://hooks.stashh.me/meta/instagram

Forwarded by the relay:
  prod  https://instagram.stashh.me/webhooks   (tunnel stashh-prod on home-server → instagram:3002)
  dev   https://ig-dev.stashh.me/webhooks      (tunnel stashh-dev on the dev Mac → 127.0.0.1:3002)

  GET https://hooks.stashh.me/health → "ok"
```

## Commands

English, typed as the whole message, open to any account:

| Command | What it does |
|---|---|
| `/env` | Says where this account routes now. |
| `/env dev` · `/env prod` | Routes this account there. `development`, `prd`, `production` and `/env=dev` work too. Holds until `/env prod`. |

- The command goes to the account's **new** environment, and that instance answers in the chat:
  "This account now routes to dev. Send /env prod to go back."
- Before routing someone to dev, the relay asks dev's instance (`GET /webhooks?relay=probe`, 3 s).
  Anything but 204 keeps the account where it is, and the current environment answers "dev cannot
  take this channel right now, so this account stays on prod."
- A command is never recognized and never reaches the backend. It is stored as a message with the
  `env` intent and answered through the Send API like any reply.
- `/env` that reaches an instance straight from Meta (no relay in front, a rollback) is an ordinary
  message, and gets the help reply.
- Anyone who types `/env dev` by accident loses only their own replies until `/env prod`: dev
  writes only to people the relay routed to it.

## How it works

1. **The Worker** (`workers/hooks/src/handle.ts`)
   1. Checks Meta's `X-Hub-Signature-256` with the Instagram app secret. A bad one gets 403.
   2. Cuts the delivery by sender: the party that is not @stashh.me (the sender of a DM, the
      recipient of an echo). Events that belong to no one go to the default environment.
   3. Reads each sender's environment from KV (`route:instagram:<IGSID>`); no key means `prod`.
   4. Applies `/env` commands. A command travels alone, in its own request.
   5. Re-signs each part with the same app secret, so the instance checks it like Meta's own.
   6. Seals the relay envelope over the exact body with `HOOKS_RELAY_SECRET`:
      `x-hooks-relay-env`, `x-hooks-relay-command`, `x-hooks-relay-signature`.
2. **Delivery** (`workers/hooks/src/deliver.ts`)
   - **Prod** is posted while Meta waits, and prod's status is Meta's answer. If prod is down,
     Meta retries for up to 36 hours.
   - **Dev** is posted right after Meta has its 200, in `waitUntil` (two tries of 10 s). Only what
     did not land goes to the `stashh-hooks-deliveries` queue: 5 retries from 30 s to 8 minutes,
     then the dead-letter queue `stashh-hooks-deliveries-dlq`. Meta gets 200 either way, so a
     closed tunnel never makes Meta unsubscribe the app. Dev never falls back to prod.
3. **The instance** (`instagram/src/webhooks/routes.ts`)
   1. Checks Meta's signature, then the envelope. An envelope that does not hold gets 403. A
      delivery without one came straight from Meta and is accepted as before.
   2. Stores each message with its environment, whether the relay routed it here, and the
      command outcome (`instagram_messages.environment`, `relay_routed`, `relay_command`).
   3. The worker claims only its own environment's messages and answers a command with
      `commandReply` (`instagram/src/webhooks/core/commands.ts`).

The shared core (environments, commands, WebCrypto HMAC, the envelope, the Instagram source) lives
in [`instagram/src/webhooks/core/`](../instagram/src/webhooks/core), inside the instagram image's
build context; the Worker imports it by relative path. Web APIs only, no Node.

## Outside production, nobody real is written to

Production and the dev Mac share one Supabase project and one Instagram account. Two rules keep
them apart:

- **One queue per environment.** Every message records the instance that received it, and
  `claim_instagram_messages(p_environment)` hands each worker only its own. Production never
  processes a teammate's dev messages, and dev never touches production's.
- **Dev writes only to routed senders.** `META_OUTBOUND` (`instagram/src/conversation/outbound.ts`):
  - production is always `live`;
  - elsewhere the default is `routed`: only messages whose envelope named this environment
    (`relay_routed`) are answered;
  - `live` answers anyone, `off` no one, an unknown value is `off`.
- A blocked message is settled `failed` before any side effect: no recognition, no typing
  indicator, no reply. Every outbound path in the service runs inside `MessageProcessor.process`,
  behind that one check; a new one must ask `mayMessage` too.
- To test locally **without** the relay (Meta's callback pointed straight at `ig-dev.stashh.me`),
  set `META_OUTBOUND=live` in `instagram/.env`.

Why on the message and not on a person: Stashh has no contacts table, and the channel never reads
backend tables (`channel_identities` is the backend's). The envelope already says, per delivery,
that the relay routed this sender here, so the message carries it.

## Rollout

In this order. Each step can be checked before the next; nothing before step 8 changes what Meta
does.

Meta's callback was `https://ig-dev.stashh.me/webhooks/instagram` before the relay, served by
production through `stashh-prod`. So `ig-dev` moves to the dev Mac only **after** the callback has
moved to the relay (step 10): moved first, it would send every production DM to the Mac.

1. **Database.** Apply `supabase/migrations/20261101140000_instagram_messages_relay.sql` to the
   Supabase project **before** the code reaches `develop` (home-server deploys within a minute and
   the new code writes the new columns). It is additive: the running service keeps working on it.
2. **Relay secret.** Generate one value (`openssl rand -hex 32`) and put it, as
   `HOOKS_RELAY_SECRET`, in:
   - home-server's `~/HomeServer/stashh/env/instagram.env`;
   - the dev Mac's `instagram/.env`;
   - the Worker (step 5).
3. **Deploy the instance.** Merge to `develop`; home-server deploys it. If only the env file
   changed: `ssh home-server ~/HomeServer/bin/stashh-update.sh --force`. Check:
   ```bash
   curl -i https://instagram.stashh.me/webhooks?relay=probe   # 204
   ```
4. **Cloudflare resources**, in the account that holds the stashh.me zone (dashboard, or
   `npx wrangler` in `workers/hooks/` when it is signed in to that account):
   - Workers KV → create `stashh-hooks-routes`; put its id in `wrangler.jsonc` → `env.production`
     and commit it (it is not a secret).
   - Queues → create `stashh-hooks-deliveries` and `stashh-hooks-deliveries-dlq`.
5. **Deploy the Worker** `stashh-hooks` (`npm run hooks:deploy:prod`, or Workers Builds on this
   repo: root `workers/hooks`, build `npm ci`, deploy `npx wrangler deploy --env production`).
   `custom_domain: true` makes Cloudflare create `hooks.stashh.me` and its certificate; there must
   be no other DNS record for that name. Then its secrets (Settings → Variables and Secrets, or
   `npx wrangler secret put <NAME> --env production`):
   - `INSTAGRAM_APP_SECRET`: Meta → Instagram → API setup with Instagram login;
   - `HOOKS_RELAY_SECRET`: the value from step 2.
6. **Check the relay:**
   ```bash
   curl https://hooks.stashh.me/health                                          # ok
   curl "https://hooks.stashh.me/meta/instagram?hub.mode=subscribe&hub.verify_token=<WEBHOOK_VERIFY_TOKEN>&hub.challenge=42"   # 42, answered by prod
   ```
7. **Watch production** before the switch: `npm run hooks:tail:prod` (or Workers → stashh-hooks →
   Logs) and the newest `instagram_messages` rows.
8. **Switch Meta's callback.** Meta App Dashboard → Stashh → Instagram → API setup with Instagram
   login → Configure webhooks: Callback URL `https://hooks.stashh.me/meta/instagram`, the same
   verify token. Meta's verification request goes through the relay to prod.
9. **Verify prod through the relay**, from your own Instagram account: share a Reel; prod answers,
   the log shows `relayed` with `prod: 1`, and a new `instagram_messages` row has
   `environment = prod`. Only then go on.
10. **Free `ig-dev` from production.** Remove the `ig-dev.stashh.me` rule from
    `deploy/tunnel/config.yml` (home-server recreates the tunnel on deploy), then set up the dev
    tunnel ([below](#dev-tunnel)): `stashh-dev`, `ig-dev.stashh.me` routed to it, token file,
    `npm run tunnel:install`, then `npm run tunnel:status` → probe 204 while `npm run dev` runs.
11. **Verify dev**, with the log open:
    - `/env dev`: dev answers "This account now routes to dev. Send /env prod to go back.";
      `env_set` in the log.
    - Share a Reel: dev answers (`direct_delivery` `delivered`); prod's ops view shows nothing new.
    - `/env prod`: prod answers "This account now routes to prod."
    - Workers KV → `stashh-hooks-routes` lists only accounts that are on dev.
12. Later: remove the transitional `/webhooks/instagram` mount in `instagram/src/http/app.ts`; the
    relay posts to `/webhooks`.

### Rollback

Point Meta's callback back at `https://instagram.stashh.me/webhooks`. The instance accepts a
delivery without an envelope exactly as before; the KV routes simply stop mattering. Messages
already stored for dev stay dev's.

## Locally

- `npm run hooks:dev` in `workers/hooks/` runs the Worker on `127.0.0.1:8787` with local KV and
  queue; its default environment is `dev` → `http://localhost:3002`. Copy `.dev.vars.example` to
  `.dev.vars`; the same `HOOKS_RELAY_SECRET` goes into `instagram/.env`.
- POST a delivery signed with the local `INSTAGRAM_APP_SECRET` to
  `http://127.0.0.1:8787/meta/instagram` to see the whole chain.
- `npm run hooks:test` runs the relay end to end with fakes (`src/handle.test.ts`);
  `npm run hooks:typecheck` checks the Worker and the shared core.

## Deploys

The Worker `stashh-hooks` deploys itself: Cloudflare Workers Builds watches `develop` of
`lb-apps/stashh` (root `workers/hooks`, build `npm ci`, deploy `npx wrangler deploy --env production`,
`NODE_VERSION=24`, no preview builds). A merge to `develop` ships it, as home-server ships the
services. Builds and their logs: Workers & Pages → stashh-hooks → Deployments.
`npm run hooks:deploy:prod` still works from a machine whose wrangler is signed in to the stashh.me
account.

## Logs

`npm run hooks:tail:prod` (in `workers/hooks/`). One JSON line per event: `relayed`,
`direct_delivery`, `queued_delivery`, `env_set`, `env_unavailable`, `handshake`,
`signature_refused`, `oversized_delivery`, `enqueue_failed`. No body, sender id or IP is ever
logged.

## Dev tunnel

`/env dev` works only while the Mac answers the probe: `https://ig-dev.stashh.me/webhooks?relay=probe`
→ 204 within 3 s. That needs:

- the instagram service on `:3002` (`npm run dev` in `instagram/`) with `HOOKS_RELAY_SECRET` set;
- the `stashh-dev` tunnel up. A tunnel started from a terminal or an agent session dies with it,
  and every `/env dev` after that is refused. So the tunnel is a LaunchAgent: it starts at login and
  comes back when it stops.

Once, on the dev Mac (named for the environment that runs it, like `stashh-prod`):

```bash
cloudflared tunnel create stashh-dev
cloudflared tunnel route dns --overwrite-dns stashh-dev ig-dev.stashh.me   # only after rollout step 9
cloudflared tunnel token stashh-dev > ~/.cloudflared/stashh-dev.token && chmod 600 ~/.cloudflared/stashh-dev.token
```

Then, in `instagram/`:

```
npm run tunnel:install     # writes the LaunchAgent me.stashh.dev-tunnel and starts it
npm run tunnel:status      # is it running, is :3002 listening, does the probe answer 204
npm run tunnel:uninstall   # when testing is over
```

The token stays in `~/.cloudflared/stashh-dev.token` and is read with `--token-file`; the log is
`~/Library/Logs/stashh/dev-tunnel.log`.
