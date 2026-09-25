#!/bin/sh
set -eu

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_DIR"

COMPOSE="docker compose -p ifics-dev -f docker-compose.dev.yml"

echo "============================================================"
echo "IFICS V1.0 - VALIDATION FINALE"
echo "============================================================"

echo
echo_section() {
  echo
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

echo_section "1. SERVICES DE TEST"
$COMPOSE up -d db clamav


echo_section "2. PRISMA - VALIDATION DU SCHEMA"
$COMPOSE run --rm app npx prisma validate


echo_section "3. PRISMA - GENERATION CLIENT"
$COMPOSE run --rm app npx prisma generate


echo_section "4. PRISMA - MIGRATIONS DEV"
$COMPOSE run --rm app npx prisma migrate deploy
$COMPOSE run --rm app npx prisma migrate status


echo_section "5. ESLINT GLOBAL"
$COMPOSE run --rm app npm run lint


echo_section "6. TYPECHECK GLOBAL"
$COMPOSE run --rm app npm run typecheck


echo_section "7. TESTS UNITAIRES"
$COMPOSE run --rm app npx vitest run tests/unit


echo_section "8. TESTS D'INTEGRATION COMPLETS"
$COMPOSE run --rm \
  -e ACCOUNTING_INTEGRATION_TESTS=1 \
  -e BILLING_PAYMENT_INTEGRATION_TESTS=1 \
  -e CRA_INTEGRATION_TESTS=1 \
  -e EXPENSE_INTEGRATION_TESTS=1 \
  -e PROJECT_INTEGRATION_TESTS=1 \
  -e SETTINGS_INTEGRATION_TESTS=1 \
  -e CLAMAV_INTEGRATION_TESTS=1 \
  app npx vitest run tests/integration


echo_section "9. BUILD PRODUCTION"
$COMPOSE run --rm app npm run build


echo_section "10. AUDIT DEPENDANCES PRODUCTION"
$COMPOSE run --rm app npm audit --omit=dev --audit-level=high


echo_section "11. COHERENCE DES ROUTES DASHBOARD"
python3 - <<'PY'
from pathlib import Path
import re
import sys

root = Path('app/pages')
pages = set()

for path in root.rglob('*.vue'):
    rel = path.relative_to(root)
    parts = list(rel.parts)
    if parts[-1] == 'index.vue':
        parts = parts[:-1]
    else:
        parts[-1] = parts[-1][:-4]

    route = '/' + '/'.join(parts)
    route = re.sub(r'/\[([^\]]+)\]', r'/:\1', route)
    pages.add(route.rstrip('/') or '/')

links = []
for path in Path('app').rglob('*.vue'):
    text = path.read_text(errors='ignore')
    for match in re.finditer(r'''(?:to|href)=["'](/dashboard[^"'?#`]*)''', text):
        links.append((str(path), match.group(1).rstrip('/') or '/'))

def matches(link: str, page: str) -> bool:
    pattern = re.escape(page)
    pattern = re.sub(r':\\[^/]+', r'[^/]+', pattern)
    return re.fullmatch(pattern, link) is not None

missing = [
    (source, link)
    for source, link in sorted(set(links))
    if not any(matches(link, page) for page in pages)
]

if missing:
    for source, link in missing:
        print(f'LIEN SANS PAGE : {link} <- {source}')
    sys.exit(1)

print(f'OK : {len(pages)} pages, {len(set(links))} liens dashboard contrôlés.')
PY


echo_section "12. LIBELLES FRANCAIS"
if grep -RInE \
  --include='*.ts' \
  --include='*.vue' \
  --exclude-dir=node_modules \
  --exclude-dir=.nuxt \
  --exclude-dir=.output \
  '\(s\)|\(e\)|\(es\)' \
  app server
then
  echo "ERREUR : des pluriels de type (s)/(e) subsistent."
  exit 1
fi

echo "OK : aucun pluriel parenthesé détecté."


echo_section "13. DIFF CHECK"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check
else
  echo "INFO : archive sans métadonnées Git, contrôle git diff ignoré."
fi

if [ "${RUN_PRODUCTION_PREFLIGHT:-0}" = "1" ]; then
  echo_section "14. PREFLIGHT PRODUCTION"
  sh scripts/preflight.sh
else
  echo_section "14. PREFLIGHT PRODUCTION"
  echo "INFO : non exécuté. Relancer avec RUN_PRODUCTION_PREFLIGHT=1 après configuration de l'environnement de production."
fi


echo
echo "============================================================"
echo "IFICS V1.0 - CAMPAGNE FINALE TERMINEE AVEC SUCCES"
echo "============================================================"
