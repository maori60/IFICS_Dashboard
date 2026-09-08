#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

BACKUP_ROOT=${BACKUP_DIR:-"$ROOT_DIR/backups"}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$BACKUP_ROOT/ifics-$STAMP"

command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose is required" >&2; exit 1; }

mkdir -p "$DEST"
chmod 700 "$DEST"

echo "[1/4] PostgreSQL backup"
docker compose exec -T db sh -c 'exec pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$DEST/database.dump"

echo "[2/4] Uploaded files backup"
docker compose run --rm -T --no-deps --entrypoint sh app -c 'cd /app && tar -czf - uploads' > "$DEST/uploads.tar.gz"

echo "[3/4] Metadata and checksums"
{
  echo "created_at_utc=$STAMP"
  echo "git_commit=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "database_format=pg_dump_custom"
  echo "uploads_format=tar_gzip"
} > "$DEST/metadata.txt"
(
  cd "$DEST"
  sha256sum database.dump uploads.tar.gz metadata.txt > SHA256SUMS
)

echo "[4/4] Local retention (${RETENTION_DAYS} days)"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'ifics-*' -mtime "+$RETENTION_DAYS" -exec rm -rf -- {} +

echo "Backup created: $DEST"
echo "Copy this directory to an encrypted off-host destination."
