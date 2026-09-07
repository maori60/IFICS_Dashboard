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
	@echo "Applying versioned database migrations..."
	$(DEV_COMPOSE) run --rm app npx prisma migrate deploy
	@echo "Seeding development data explicitly..."
	$(DEV_COMPOSE) run --rm app npm run db:seed
	@echo "Starting IFICS development application..."
	$(DEV_COMPOSE) up -d app
	$(DEV_COMPOSE) ps

dev-up:
	@echo "Starting IFICS development stack..."
	$(DEV_COMPOSE) up -d

dev-down:
	@echo "Stopping IFICS development stack..."
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
	$(DEV_COMPOSE) run --rm app npm run db:seed

dev-generate:
	$(DEV_COMPOSE) run --rm app npx prisma generate

dev-reset:
	@echo "WARNING: this deletes the DEVELOPMENT database contents."
	$(DEV_COMPOSE) run --rm app npx prisma migrate reset --force --skip-seed
	$(DEV_COMPOSE) run --rm app npm run db:seed

dev-shell-app:
	$(DEV_COMPOSE) exec app sh

dev-shell-db:
	$(DEV_COMPOSE) exec db sh

dev-clean:
	@echo "WARNING: removing IFICS DEVELOPMENT containers and volumes."
	$(DEV_COMPOSE) down -v

# -----------------------------------------------------------------------------
# Production-like local stack
# This is NOT the final production deployment definition. It exists so the
# release image can be exercised without development bind mounts.
# -----------------------------------------------------------------------------

build:
	$(COMPOSE) build

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

shell-app:
	$(COMPOSE) exec app sh

shell-db:
	$(COMPOSE) exec db sh

# Intentionally no automatic db-push or seed on container startup.
# Production migrations will be handled by an explicit deployment workflow.

.PHONY: dev-build dev-db dev-init dev-up dev-down dev-restart dev-logs dev-ps \
	dev-migrate dev-seed dev-generate dev-reset dev-shell-app dev-shell-db dev-clean \
	build up down restart logs ps shell-app shell-db
