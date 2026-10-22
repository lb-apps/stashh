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
  and runs unlimited (see [A Linux host instead](#a-linux-host-instead)).

Verify: `docker compose ps` shows all four healthy; `http://<host>:3004` (Dozzle) shows their logs; `curl localhost:3000/health` and
`curl localhost:3002/health` answer; `curl https://instagram.stashh.me/health` → 200 through the tunnel.

Naming: a tunnel is a connector identity, so it is named for the environment that runs it
(`stashh-prod`; a staging host would get `stashh-staging`). Hostnames name the service behind them
(`instagram.stashh.me`; `api.stashh.me` once the backend is exposed). The production connector runs
only on the production host: a second connector anywhere else would receive half of Meta's deliveries.

## `home-server` follows the repo

Production runs on `home-server`, the Mac mini on the home LAN (Apple silicon, macOS; Ethernet
`192.168.68.60`, Tailscale `home-server`). It took over from the Raspberry Pi 5 on 2026-10-21,
along with the Pi's LAN address. It deploys itself: a LaunchDaemon runs
[`deploy/update.sh`](../deploy/update.sh) every minute, which fetches the tracked branch and, when
its commit moved, checks it out, rebuilds the images and restarts the stack. A push to `develop`
is live within about a minute plus the build.

Why pull, not push: the host sits behind NAT with no inbound port but the tunnel; the repo is
public, so a GitHub Actions self-hosted runner on it is out (GitHub's own guidance: forks could
run code on it); a webhook receiver would need a second public hostname. Polling `git fetch`
needs none of that and nothing but the repo's branch can change what runs.

macOS has no Docker Engine of its own, so the containers run in a [Lima](https://lima-vm.io) VM
named `docker` (Ubuntu, `vz`, 4 CPUs, 4 GiB, 40 GiB disk), started at boot by the LaunchDaemon
`io.lima-vm.daemon.docker`. The Homebrew `docker` CLI reaches it through the `lima-docker`
context (`DOCKER_HOST=unix:///Users/emirerdo/.lima/docker/sock/docker.sock`). The compose memory
limits are enforced inside the VM.

Lima forwards a published port to the Mac's `127.0.0.1` unless told otherwise, so
`~/.lima/docker/lima.yaml` forwards 3000, 3002 and 3004 to `0.0.0.0`: the API, the channel and
Dozzle answer on the LAN and on Tailscale (`http://home-server:3000`). A change there takes effect
when the VM restarts.

Layout on `home-server` (user `emirerdo`, `ssh home-server`):

| Path | Content |
|---|---|
| `~/HomeServer/stashh/repo` | the clone the job deploys from (never edit; it is reset to the branch) |
| `~/HomeServer/stashh/env/backend.env`, `instagram.env`, `tunnel.env` | the compose env files, mode 600 |
| `~/HomeServer/stashh/env/deploy.env` | `STASHH_BRANCH` (`develop`), `STASHH_REPO_DIR`, `STASHH_ENV_DIR` |
| `~/HomeServer/bin/stashh-update.sh` | loads `deploy.env`, points `DOCKER_HOST` at the VM, runs the repo's `deploy/update.sh`; exits quietly while the VM is still booting |
| `/Library/LaunchDaemons/com.homeserver.stashh-update.plist` | runs that script every 60 s as `emirerdo` (copy in `~/HomeServer/launchd/`) |
| `~/HomeServer/logs/com.homeserver.stashh-update.log` | what each deploy did |
| `~/.lima/docker/lima.yaml` | the VM: size, port forwards |

The wrapper and the LaunchDaemons belong to the home server's own setup in `~/HomeServer`, next to
the home automation that shares the machine; they are not in this repo.

### Operate

```bash
ssh home-server
tail -n 50 ~/HomeServer/logs/com.homeserver.stashh-update.log     # what the last deploys did
docker compose -f ~/HomeServer/stashh/repo/compose.yaml ps       # health of the four containers
docker compose -f ~/HomeServer/stashh/repo/compose.yaml logs -f backend
~/HomeServer/bin/stashh-update.sh                                # deploy now instead of in a minute
limactl list                                                     # is the VM running
```

Dozzle: `http://home-server:3004` from any machine on the LAN or the tailnet.

- **Changed an env file:** the commit did not move, so force it: `~/HomeServer/bin/stashh-update.sh --force`.
- **Roll back:** revert on the branch and push; the next run deploys the revert. Old images are
  pruned after each deploy, so there is no local image to fall back to.
- **Follow another branch:** edit `STASHH_BRANCH` in `~/HomeServer/stashh/env/deploy.env`; the
  next run switches.
- **A failed deploy:** `docker compose build` failing leaves the old containers running;
  `docker compose up --wait` failing (a container never healthy) leaves the new ones up for
  `docker compose logs` to explain. Either way the log says so and the job tries again when the
  branch moves.
- **Restart the VM** (after editing `lima.yaml`): `limactl stop docker && limactl start docker`.
  The containers come back by themselves (`restart: unless-stopped`); expect about 20 s without
  the API or the channel, during which Meta retries its webhook deliveries.

### A Linux host instead

[`deploy/install.sh`](../deploy/install.sh) sets up the same pull-based deploy on a Linux host with
systemd (it ran the Raspberry Pi): the clone in `/srv/stashh/repo`, the env files in
`/srv/stashh/env`, and [`deploy/systemd/`](../deploy/systemd/)'s `stashh-update.timer` instead of the
LaunchDaemon.

1. Docker Engine + Compose from Docker's apt repo (`docker-ce docker-ce-cli containerd.io
   docker-buildx-plugin docker-compose-plugin`); `/etc/docker/daemon.json` with json-file log
   rotation (`max-size 10m`, `max-file 3`); the deploying user in the `docker` group.
2. A kernel booted without the memory cgroup ignores the compose memory limits. Raspberry Pi OS
   is one: append `cgroup_enable=memory cgroup_memory=1` to `/boot/firmware/cmdline.txt` and reboot.
3. ```bash
   sudo mkdir -p /srv/stashh && sudo chown "$USER" /srv/stashh
   git clone https://github.com/lb-apps/stashh.git /srv/stashh/repo
   /srv/stashh/repo/deploy/install.sh     # seeds /srv/stashh/env, installs the units
   # fill in /srv/stashh/env/*.env, then:
   /srv/stashh/repo/deploy/install.sh     # enables the timer and runs the first deploy
   ```

Then `journalctl -u stashh-update` holds the deploy log and `sudo systemctl start stashh-update`
deploys now. Stop the other host's job and tunnel connector first: only one host may run them.

### The ops dashboard

`ops/` stays on the development Mac and reads production over the LAN or Tailscale:
`STASHH_API_URL=http://home-server:3000` and `INSTAGRAM_API_URL=http://home-server:3002` in
`ops/.env.local`, with the tokens that match the `INTERNAL_API_TOKENS` / `OPS_API_TOKENS` entries
in `home-server`'s env files.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) typechecks and tests `backend/` and
`instagram/` on Node 24 and builds both images, on every push to `develop`/`master` and every
pull request. `home-server` deploys the branch head regardless of CI; a change that does not build
never replaces what runs.
