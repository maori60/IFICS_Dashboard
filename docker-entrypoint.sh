#!/bin/sh
set -eu

# Runtime entrypoint intentionally performs no schema mutation and no seed.
# Database migrations are explicit deployment operations and are never tied to a
# container restart.

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "Starting IFICS application..."
exec npm run start
