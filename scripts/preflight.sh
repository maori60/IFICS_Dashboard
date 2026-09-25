#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

FAIL=0
warn() { printf 'WARN: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1" >&2; FAIL=1; }
ok() { printf 'OK: %s\n' "$1"; }

printf '%s\n' '========================================'
printf '%s\n' 'IFICS V1.0 - PREVOL PRODUCTION'
printf '%s\n' '========================================'

[ -f .env ] || fail '.env absent'

if [ -f .env ]; then
  chmod 600 .env 2>/dev/null || true
  if grep -Eq 'CHANGE_ME|ifics\.example\.org|admin@example\.invalid' .env; then
    fail '.env contient encore une valeur de démonstration'
  else
    ok '.env ne contient pas de placeholder connu'
  fi

  for key in DATABASE_URL APP_BASE_URL APP_ENCRYPTION_KEY IP_HASH_PEPPER INTERNAL_JOB_TOKEN; do
    if grep -Eq "^${key}=.+" .env; then
      ok "$key configuré"
    else
      fail "$key manquant"
    fi
  done

  if grep -Eq '^APP_BASE_URL=https://' .env; then
    ok 'APP_BASE_URL utilise HTTPS'
  else
    fail 'APP_BASE_URL doit utiliser HTTPS en production'
  fi

  if grep -Eq '^SMTP_HOST=.+$' .env; then
    ok 'SMTP configuré'
  else
    warn 'SMTP_HOST vide : invitations et resets e-mail ne seront pas délivrés'
  fi
fi

command -v docker >/dev/null 2>&1 || fail 'docker absent'
if command -v docker >/dev/null 2>&1; then
  docker compose version >/dev/null 2>&1 && ok 'docker compose disponible' || fail 'docker compose indisponible'
  if docker compose config >/dev/null 2>&1; then
    ok 'docker compose config valide'
  else
    fail 'docker compose config invalide'
  fi
fi

if [ -d backups ]; then
  latest=$(find backups -mindepth 1 -maxdepth 1 -type d -name 'ifics-*' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || true)
  if [ -n "$latest" ]; then
    ok "sauvegarde locale détectée : $latest"
  else
    warn 'aucune sauvegarde locale IFICS détectée'
  fi
else
  warn 'répertoire backups absent'
fi

FREE_KB=$(df -Pk . | awk 'NR==2 {print $4}')
if [ "${FREE_KB:-0}" -lt 2097152 ]; then
  fail 'moins de 2 Go libres sur le volume applicatif'
else
  ok 'espace disque applicatif >= 2 Go'
fi

if [ "$FAIL" -ne 0 ]; then
  printf '%s\n' 'PREVOL EN ECHEC'
  exit 1
fi

printf '%s\n' 'PREVOL OK'
