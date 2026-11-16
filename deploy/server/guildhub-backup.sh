#!/usr/bin/env bash
# Install as /usr/local/bin/guildhub-backup and run nightly from cron as root:
#   guildhub-backup <deploy-dir> [backup-dir] [days-to-keep]
set -euo pipefail

dir=${1:?usage: guildhub-backup <deploy-dir> [backup-dir] [days-to-keep]}
target=${2:-/var/backups/guildhub}
keep=${3:-14}

install -d -m 700 "$target"
file="$target/guildhub-$(date -u +%Y%m%dT%H%M%SZ).dump"

cd "$dir"
docker compose exec -T postgres pg_dump -U guildhub -d guildhub --format=custom >"$file.partial"
mv "$file.partial" "$file"
chmod 600 "$file"

find "$target" -name 'guildhub-*.dump' -mtime +"$keep" -delete
echo "$file"
