# Deploying Stashh

Production is two services and a tunnel, run as containers from the root [`compose.yaml`](../compose.yaml):

| Service | Image | Port | Role |
|---|---|---|---|
| `backend` | built from [`backend/Dockerfile`](../backend/Dockerfile) | 3000 | API and recognition worker in one process (`node dist/start.js`) |
| `instagram` | built from [`instagram/Dockerfile`](../instagram/Dockerfile) | 3002 | Instagram DM channel (Node 24 runs the TypeScript as it is) |
| `tunnel` | `cloudflare/cloudflared` | — | Cloudflare tunnel connector (`stashh-prod`): `https://instagram.stashh.me` → `instagram:3002`, so Meta's webhook reaches the host |
| `dozzle` | `amir20/dozzle` | 3004 | Logs, status and live CPU/memory of every container, in the browser. Login is set up in its UI on first visit; users live in the `dozzle_data` volume |

Supabase holds every byte of state; the containers are stateless and can be replaced at any
time. `web/` (Vercel) and `ops/` (local only) are not part of the stack. Images are built from
source on the host that runs them, so no registry and no secrets in images.

## On any Docker host

```bash
git clone https://github.com/lb-apps/stashh.git && cd stashh
cp backend/.env.example deploy/backend.env       # fill in
cp instagram/.env.example deploy/instagram.env   # fill in; leave WEBHOOK_CAPTURE_DIR out
cp deploy/tunnel.env.example deploy/tunnel.env   # TUNNEL_TOKEN
docker compose up -d --build --wait
```

- `deploy/*.env` are gitignored. `NODE_ENV`, `PORT` and `STASHH_API_URL` are set by compose; a
  value in the env file for them is ignored. `WEBHOOK_CAPTURE_DIR` is refused in production.
- `DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD` in `backend.env` are optional; the ops dashboard's link
  tester needs them (`GET /internal/v1/ops/test-user-token`, behind the service token).
- The tunnel token: `cloudflared tunnel token stashh-prod` on a machine with the account
  certificate (the owner's Mac), or Zero Trust → Networks → Tunnels. Run the connector on one
  host at a time; Cloudflare balances between connectors, so two hosts would split Meta's deliveries.
- Env files outside the checkout: `STASHH_ENV_DIR=/path docker compose …`.
- Memory limits (1 GB, 256 MB, 128 MB) need the kernel's memory cgroup; without it Docker warns
  and runs unlimited (Raspberry Pi OS: see below).

Verify: `docker compose ps` shows all four healthy; `http://<host>:3004` (Dozzle) shows their logs; `curl localhost:3000/health` and
`curl localhost:3002/health` answer; `curl https://instagram.stashh.me/health` → 200 through the tunnel.

Naming: a tunnel is a connector identity, so it is named for the environment that runs it
(`stashh-prod`; a staging host would get `stashh-staging`). Hostnames name the service behind them
(`instagram.stashh.me`; `api.stashh.me` once the backend is exposed). The production connector runs
only on the production host: a second connector anywhere else would receive half of Meta's deliveries.

## The home Pi follows the repo

The Raspberry Pi 5 `homeserver` on the home LAN runs production and deploys itself: a systemd
timer runs [`deploy/update.sh`](../deploy/update.sh) every minute, which fetches the tracked
branch and, when its commit moved, checks it out, rebuilds the images and restarts the stack.
A push to `develop` is live within about a minute plus the build (a few minutes on the Pi
for a backend change; seconds when only `instagram/` changed, thanks to the build cache).

Why pull, not push: the Pi sits behind NAT with no inbound port but the tunnel; the repo is
public, so a GitHub Actions self-hosted runner on it is out (GitHub's own guidance: forks could
run code on it); a webhook receiver would need a second public hostname. Polling `git fetch`
needs none of that and nothing but the repo's branch can change what runs.

Layout on the Pi:

| Path | Content |
|---|---|
| `/srv/stashh/repo` | the clone the timer deploys from (never edit; it is reset to the branch) |
| `/srv/stashh/env/backend.env`, `instagram.env`, `tunnel.env` | the compose env files, mode 600 |
| `/srv/stashh/env/deploy.env` | `STASHH_BRANCH` (`develop`), `STASHH_REPO_DIR`, `STASHH_ENV_DIR` |
| `/etc/systemd/system/stashh-update.{service,timer}` | from [`deploy/systemd/`](../deploy/systemd/), installed by `deploy/install.sh` |

### Set up a host like it (once)

1. Docker Engine + Compose from Docker's apt repo (`docker-ce docker-ce-cli containerd.io
   docker-buildx-plugin docker-compose-plugin`); `/etc/docker/daemon.json` with json-file log
   rotation (`max-size 10m`, `max-file 3`) so logs never fill the SD card; the deploying user in
   the `docker` group.
2. Raspberry Pi OS boots without the memory cgroup: append `cgroup_enable=memory cgroup_memory=1`
   to `/boot/firmware/cmdline.txt` and reboot, or the compose memory limits are ignored.
3. ```bash
   sudo mkdir -p /srv/stashh && sudo chown "$USER" /srv/stashh
   git clone https://github.com/lb-apps/stashh.git /srv/stashh/repo
   /srv/stashh/repo/deploy/install.sh     # seeds /srv/stashh/env, installs the units
   # fill in /srv/stashh/env/*.env, then:
   /srv/stashh/repo/deploy/install.sh     # enables the timer and runs the first deploy
   ```

### Operate

```bash
journalctl -u stashh-update -n 50                       # what the last deploys did
docker compose -f /srv/stashh/repo/compose.yaml ps       # health of the four containers
open http://<pi>:3004                                   # Dozzle: logs, status, CPU and memory
docker compose -f /srv/stashh/repo/compose.yaml logs -f backend
sudo systemctl start stashh-update                      # deploy now instead of in a minute
```

- **Changed an env file:** the commit did not move, so run the script with `--force`:
  `cd /srv/stashh/repo && set -a && . /srv/stashh/env/deploy.env && set +a && deploy/update.sh --force`.
- **Roll back:** revert on the branch and push; the timer deploys the revert. Old images are
  pruned after each deploy, so there is no local image to fall back to.
- **Follow another branch:** edit `STASHH_BRANCH` in `/srv/stashh/env/deploy.env`, then
  `sudo systemctl start stashh-update`.
- **A failed deploy:** `docker compose build` failing leaves the old containers running;
  `docker compose up --wait` failing (a container never healthy) leaves the new ones up for
  `docker compose logs` to explain. Either way the unit shows as failed in `systemctl status
  stashh-update` and the timer tries again when the branch moves.

### The ops dashboard

`ops/` stays on the Mac and reads the Pi: `STASHH_API_URL=http://<pi>:3000` and
`INSTAGRAM_API_URL=http://<pi>:3002` in `ops/.env.local`, with the same tokens as before
(`INTERNAL_API_TOKENS` / `OPS_API_TOKENS` entries in the Pi's env files).

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) typechecks and tests `backend/` and
`instagram/` on Node 24 and builds both images, on every push to `develop`/`master` and every
pull request. The Pi deploys the branch head regardless of CI; a change that does not build
never replaces what runs.
