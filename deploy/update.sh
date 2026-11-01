#!/usr/bin/env bash
# Pull-based deploy. Fetches the tracked branch and, when its commit moved, rebuilds the images
# and restarts the compose stack. Run every minute by the host's scheduler: a LaunchDaemon on
# home-server, stashh-update.timer (deploy/systemd) on a Linux host. By hand:
#   deploy/update.sh           deploy if the branch moved
#   deploy/update.sh --force   rebuild and restart even if it did not (after an env file change)
# To roll back, revert on the branch: the next run deploys the revert.
# Settings (the scheduler loads them from the host's deploy.env; see docs/deploy.md):
#   STASHH_REPO_DIR   checkout to deploy from   default: the repo this script is in
#   STASHH_BRANCH     branch to follow           default: develop
#   STASHH_ENV_DIR    where the *.env files are  default: <repo>/deploy
set -euo pipefail

main() {
  local repo branch current target
  repo=${STASHH_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
  branch=${STASHH_BRANCH:-develop}
  export STASHH_ENV_DIR=${STASHH_ENV_DIR:-$repo/deploy}
  cd "$repo"

  git fetch --quiet origin "$branch"
  current=$(git rev-parse HEAD)
  target=$(git rev-parse "origin/$branch")
  if [[ $current == "$target" && ${1:-} != --force ]]; then
    exit 0
  fi

  echo "deploying $branch @ ${target:0:12} (running ${current:0:12})"
  git checkout --quiet --force -B "$branch" "origin/$branch"
  docker compose build --pull
  docker compose up -d --remove-orphans --wait --wait-timeout 240
  docker image prune -f >/dev/null
  echo "deployed $branch @ ${target:0:12}"
}

# The checkout replaces this file mid-run; bash reads scripts incrementally, so everything
# is parsed into main() first and the script exits before it could read the new file.
main "$@"
exit
