#!/usr/bin/env bash
# Install as /usr/local/bin/guildhub-deploy, owned by root, not writable by
# the deploy user. Called two ways:
#   forced SSH command:  guildhub-deploy <deploy-dir>
#                        SHA in SSH_ORIGINAL_COMMAND, compose file on stdin
#   by hand:             guildhub-deploy <deploy-dir> <sha>
set -euo pipefail

dir=${1:?usage: guildhub-deploy <deploy-dir> [sha]}
sha=${SSH_ORIGINAL_COMMAND:-${2:-}}
if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "expected a full 40-character commit SHA, got '${sha}'" >&2
  exit 2
fi

cd "$dir"
exec 9>.deploy.lock
flock --nonblock 9 || { echo "another deploy is running" >&2; exit 3; }

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a deploys.log; }

if [[ ! -t 0 ]]; then
  incoming=$(mktemp compose.incoming.XXXXXX)
  cat >"$incoming"
  if [[ -s $incoming ]]; then
    GUILDHUB_TAG=$sha docker compose -f "$incoming" config --quiet
    mv "$incoming" compose.yaml
  else
    rm -f "$incoming"
  fi
fi

previous=$(sed -n 's/^GUILDHUB_TAG=//p' .env)
prefix=$(sed -n 's/^GUILDHUB_IMAGE_PREFIX=//p' .env)
export GUILDHUB_TAG=$sha

ready() {
  local api_id
  for _ in $(seq 1 60); do
    api_id=$(docker compose ps -q api)
    if [[ -n $api_id && $(docker inspect -f '{{.State.Health.Status}}' "$api_id") == healthy ]]; then
      break
    fi
    sleep 2
  done
  docker compose exec -T api node -e \
    "fetch('http://127.0.0.1:3000/health/ready').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" &&
    docker compose exec -T web wget -qO /dev/null http://127.0.0.1:8080/ &&
    [[ -n $(docker compose ps -q --status running worker) ]]
}

log "deploy ${sha} (previous ${previous:-none})"
docker compose pull --quiet api worker web postgres
docker compose run --rm migrate
docker compose up -d --remove-orphans

if ! ready; then
  log "deploy ${sha} failed its health check"
  docker compose logs --tail 80 api worker web >&2 || true
  if [[ -n $previous && $previous != "$sha" ]]; then
    log "restarting previous ${previous}"
    GUILDHUB_TAG=$previous docker compose up -d --remove-orphans
  fi
  exit 1
fi

if grep -q '^GUILDHUB_TAG=' .env; then
  sed -i "s/^GUILDHUB_TAG=.*/GUILDHUB_TAG=${sha}/" .env
else
  printf 'GUILDHUB_TAG=%s\n' "$sha" >>.env
fi
log "deploy ${sha} healthy"

if [[ -n $prefix ]]; then
  docker images --format '{{.Repository}}:{{.Tag}}' |
    grep -E "^${prefix}-(api|worker|web):" |
    grep -v -e ":${sha}\$" -e ":${previous:-none}\$" |
    xargs -r docker rmi >/dev/null || true
fi
