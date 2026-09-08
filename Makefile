COMPOSE := docker compose
DEV_COMPOSE := docker compose -f docker-compose.dev.yml

# -----------------------------------------------------------------------------
# Development stack
# -----------------------------------------------------------------------------

dev-build:
	@echo "Building IFICS development image..."
	$(DEV_COMPOSE) build app

dev-db:
	@echo "Starting development PostgreSQL..."
	$(DEV_COMPOSE) up -d db

dev-init: dev-build dev-db
	@echo "Generating Prisma client..."
	$(DEV_COMPOSE) run --rm app npx prisma generate
	@echo "Applying versioned database migrations..."
	$(DEV_COMPOSE) run --rm app npx prisma migrate deploy
	@echo "Seeding development data explicitly..."
	$(DEV_COMPOSE) run --rm app npm run db:seed
	@echo "Starting IFICS development application..."
	$(DEV_COMPOSE) up -d app
	$(DEV_COMPOSE) ps

dev-up:
	$(DEV_COMPOSE) up -d

dev-down:
	$(DEV_COMPOSE) down

dev-restart:
	$(DEV_COMPOSE) restart app

dev-logs:
	$(DEV_COMPOSE) logs -f

dev-ps:
	$(DEV_COMPOSE) ps

dev-migrate:
	$(DEV_COMPOSE) run --rm app npx prisma migrate deploy

dev-seed:
	$(DEV_COMPOSE) run --rm app npx prisma generate
	$(DEV_COMPOSE) run --rm app npm run db:seed

dev-generate:
	$(DEV_COMPOSE) run --rm app npx prisma generate

dev-reset:
	@echo "WARNING: this deletes the DEVELOPMENT database contents."
	$(DEV_COMPOSE) run --rm app npx prisma migrate reset --force --skip-seed
	$(DEV_COMPOSE) run --rm app npx prisma generate
	$(DEV_COMPOSE) run --rm app npm run db:seed

dev-shell-app:
	$(DEV_COMPOSE) exec app sh

dev-shell-db:
	$(DEV_COMPOSE) exec db sh

dev-clean:
	@echo "WARNING: removing IFICS DEVELOPMENT containers and volumes."
	$(DEV_COMPOSE) down -v

# -----------------------------------------------------------------------------
# Production / self-hosted stack
# -----------------------------------------------------------------------------

build:
	$(COMPOSE) build

prod-db:
	$(COMPOSE) up -d db

prod-migrate: prod-db
	$(COMPOSE) run --rm app npm run db:migrate

# Synchronises association and system roles. It does not create an administrator
# unless ADMIN_* variables are explicitly injected for this command.
prod-seed: prod-db
	$(COMPOSE) run --rm app npm run db:seed

prod-init: build prod-migrate prod-seed
	$(COMPOSE) up -d app
	$(COMPOSE) ps

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart app

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

ready:
	@curl --fail --silent --show-error http://127.0.0.1:$${APP_PORT:-3000}/api/ready && echo

backup:
	sh scripts/backup.sh

# Usage: RESTORE_CONFIRM=YES make restore BACKUP=/absolute/path/to/ifics-backup
restore:
	@test -n "$(BACKUP)" || (echo "BACKUP=/path/to/backup is required" >&2; exit 2)
	RESTORE_CONFIRM="$${RESTORE_CONFIRM:-}" sh scripts/restore.sh "$(BACKUP)"

shell-app:
	$(COMPOSE) exec app sh

shell-db:
	$(COMPOSE) exec db sh

.PHONY: dev-build dev-db dev-init dev-up dev-down dev-restart dev-logs dev-ps \
	dev-migrate dev-seed dev-generate dev-reset dev-shell-app dev-shell-db dev-clean \
	build prod-db prod-migrate prod-seed prod-init up down restart logs ps ready backup restore shell-app shell-db
