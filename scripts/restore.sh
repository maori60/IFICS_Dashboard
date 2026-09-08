#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: RESTORE_CONFIRM=YES $0 /path/to/ifics-backup" >&2
  exit 2
fi

if [ "${RESTORE_CONFIRM:-}" != "YES" ]; then
  echo "Restore is destructive. Re-run with RESTORE_CONFIRM=YES." >&2
  exit 2
fi

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKUP_DIR_INPUT=$(CDPATH= cd -- "$1" && pwd)
cd "$ROOT_DIR"

for file in database.dump uploads.tar.gz SHA256SUMS; do
  [ -f "$BACKUP_DIR_INPUT/$file" ] || { echo "Missing backup file: $file" >&2; exit 1; }
done

command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose is required" >&2; exit 1; }

echo "[1/7] Verify backup integrity"
(
  cd "$BACKUP_DIR_INPUT"
  sha256sum -c SHA256SUMS
)

echo "[2/7] Stop application writes"
docker compose stop app >/dev/null 2>&1 || true

echo "[3/7] Start PostgreSQL"
docker compose up -d db

DB_ID=$(docker compose ps -q db)
[ -n "$DB_ID" ] || { echo "PostgreSQL container is not running" >&2; exit 1; }

TRIES=0
until docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  [ "$TRIES" -lt 30 ] || { echo "PostgreSQL did not become ready" >&2; exit 1; }
  sleep 1
done

echo "[4/7] Recreate public schema"
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'

echo "[5/7] Restore PostgreSQL"
docker compose exec -T db sh -c 'exec pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$BACKUP_DIR_INPUT/database.dump"

echo "[6/7] Restore uploaded files"
docker compose run --rm -T --no-deps --entrypoint sh app -c 'rm -rf /app/uploads && mkdir -p /app/uploads && cd /app && tar -xzf -' < "$BACKUP_DIR_INPUT/uploads.tar.gz"

echo "[7/7] Apply any newer migrations and restart"
docker compose run --rm -T app npm run db:migrate
docker compose up -d app

echo "Restore completed. Verify: curl -fsS http://127.0.0.1:${APP_PORT:-3000}/api/ready"
