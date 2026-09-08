#!/bin/sh
set -eu

: "${INTERNAL_JOB_TOKEN:?INTERNAL_JOB_TOKEN must be set}"
BASE_URL=${INTERNAL_BASE_URL:-http://127.0.0.1:3000}

curl --fail --silent --show-error \
  --request POST \
  --header "X-Internal-Job-Token: $INTERNAL_JOB_TOKEN" \
  --header "Content-Type: application/json" \
  "$BASE_URL/api/internal/jobs/document-expiry"
printf '\n'
