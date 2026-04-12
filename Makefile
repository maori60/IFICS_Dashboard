# ===============================
# VARIABLES
# ===============================

COMPOSE = docker compose

# ===============================
# COMMANDES PRINCIPALES
# ===============================

up:
	@echo "🚀 Starting containers..."
	$(COMPOSE) up

up-build:
	@echo "🚀 Starting containers with build..."
	$(COMPOSE) up --build

build:
	@echo "🔨 Building containers..."
	$(COMPOSE) build

down:
	@echo "🛑 Stopping containers..."
	$(COMPOSE) down

restart:
	@echo "🔄 Restarting containers..."
	$(COMPOSE) down
	$(COMPOSE) up -d

logs:
	@echo "📜 Showing logs..."
	$(COMPOSE) logs -f

ps:
	@echo "📦 Containers status:"
	$(COMPOSE) ps

# ===============================
# PRISMA / BASE DE DONNÉES
# ===============================

db-push:
	@echo "🧠 Running Prisma db push..."
	$(COMPOSE) exec app npx prisma db push

db-generate:
	@echo "⚙️ Generating Prisma client..."
	$(COMPOSE) exec app npx prisma generate

db-reset:
	@echo "⚠️ Resetting database..."
	$(COMPOSE) exec app npx prisma migrate reset --force

# ===============================
# SHELL / DEBUG
# ===============================

shell-app:
	@echo "🐚 Opening shell in app container..."
	$(COMPOSE) exec app sh

shell-db:
	@echo "🐚 Opening shell in db container..."
	$(COMPOSE) exec db sh

# ===============================
# NETTOYAGE
# ===============================

clean:
	@echo "🧹 Stopping containers..."
	$(COMPOSE) down

fclean:
	@echo "💣 Removing containers, network and volumes..."
	$(COMPOSE) down -v

prune:
	@echo "🧼 Pruning unused Docker data..."
	docker system prune -af

# ===============================
# REBUILD COMPLET
# ===============================

re:
	@echo "♻️ Full rebuild..."
	$(COMPOSE) down -v
	$(COMPOSE) up --build

# ===============================
# PHONY
# ===============================

.PHONY: up up-build build down restart logs ps db-push db-generate db-reset shell-app shell-db clean fclean prune re