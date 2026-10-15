#!/usr/bin/env bash
# One-time setup of a host that follows the repo (docs/deploy.md). Run it from the clone, as
# the user who will run Docker (a member of the docker group), on a host with Docker Engine
# and Compose installed:
#
#   sudo mkdir -p /srv/stashh && sudo chown "$USER" /srv/stashh
#   git clone https://github.com/lb-apps/stashh.git /srv/stashh/repo
#   /srv/stashh/repo/deploy/install.sh
#
# Creates /srv/stashh/env with the env files to fill in, installs stashh-update.timer and, once
# every env file is filled in, starts the first deploy. Safe to run again.
set -euo pipefail

home=/srv/stashh
repo=$home/repo
env_dir=$home/env
unit_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/systemd

[[ -f $repo/compose.yaml ]] || { echo "expected the repo at $repo" >&2; exit 1; }
command -v docker >/dev/null || { echo "install Docker Engine and Compose first" >&2; exit 1; }
id -nG | tr ' ' '\n' | grep -qx docker || { echo "$USER must be in the docker group (log in again after usermod)" >&2; exit 1; }

mkdir -p "$env_dir"
chmod 700 "$env_dir"
missing=()
seed() { # seed <target> <example>
  if [[ ! -f $env_dir/$1 ]]; then
    cp "$2" "$env_dir/$1"
    chmod 600 "$env_dir/$1"
    missing+=("$1")
  fi
}
seed backend.env "$repo/backend/.env.example"
seed instagram.env "$repo/instagram/.env.example"
seed tunnel.env "$repo/deploy/tunnel.env.example"
seed deploy.env "$repo/deploy/deploy.env.example"

sed "s/__USER__/$USER/" "$unit_dir/stashh-update.service" | sudo tee /etc/systemd/system/stashh-update.service >/dev/null
sudo cp "$unit_dir/stashh-update.timer" /etc/systemd/system/stashh-update.timer
sudo systemctl daemon-reload

if (( ${#missing[@]} )); then
  echo "Fill in these files, then run $0 again:"
  printf '  %s/%s\n' "$env_dir" "${missing[@]}"
  echo "(instagram.env: leave WEBHOOK_CAPTURE_DIR out; NODE_ENV, PORT and STASHH_API_URL are set by compose.yaml)"
  exit 0
fi

sudo systemctl enable --now stashh-update.timer
echo "first deploy (builds the images; a few minutes on a Pi)…"
sudo systemctl start stashh-update.service || true
sudo systemctl --no-pager status stashh-update.service | tail -n 20
docker compose -f "$repo/compose.yaml" ps
