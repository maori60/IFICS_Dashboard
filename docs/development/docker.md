# Docker development workflow

## Goal

The development stack is intentionally separated from the future production deployment.
It provides a reproducible local environment with:

- Nuxt development server with source bind mount
- PostgreSQL 16
- persistent development database volume
- persistent development upload volume
- explicit database migrations and seed operations
- services bound to `127.0.0.1` by default

## Files

- `Dockerfile.dev`: development dependencies/image
- `docker-compose.dev.yml`: development orchestration
- `Dockerfile`: production-like application image
- `docker-compose.yml`: production-like local smoke-test stack; it is not the final production deployment
- `.env.example`: documented environment template

## First start

```bash
cp .env.example .env
```

Replace `CHANGE_ME_WITH_A_LONG_RANDOM_PASSWORD` with a unique local password and keep
`DATABASE_URL` consistent with `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`.

Then run:

```bash
make dev-init
```

`dev-init` performs explicit steps in this order:

1. build the development application image
2. start PostgreSQL
3. apply committed Prisma migrations with `prisma migrate deploy`
4. run the development seed explicitly
5. start Nuxt

No schema mutation or seed is performed merely because a container restarts.

## Daily commands

```bash
make dev-up
make dev-down
make dev-restart
make dev-logs
make dev-ps
```

When committed migrations are added:

```bash
make dev-migrate
```

To rerun the development seed:

```bash
make dev-seed
```

## Destructive development reset

```bash
make dev-reset
```

This command is for development only. It destroys and recreates the development database.

To remove all IFICS development containers and named development volumes:

```bash
make dev-clean
```

This removes both the development database and uploaded development documents.

## Persistence

Three named volumes are used by the development stack:

- `postgres_dev_data`: PostgreSQL data
- `node_modules_dev`: container dependencies
- `uploads_dev`: uploaded files

Application source code is bind-mounted from the repository into `/app` for Nuxt hot reload.

## Network exposure

The development stack binds application and PostgreSQL ports to `127.0.0.1`, not all host
interfaces. This prevents accidental exposure to the LAN/Internet during normal development.

Defaults:

- Nuxt: `127.0.0.1:3000`
- PostgreSQL: `127.0.0.1:5432`

Both host ports can be changed in `.env`.

## Validation checklist

After `make dev-init`:

```bash
make dev-ps
curl -fsS http://127.0.0.1:${APP_PORT:-3000}/ >/dev/null
```

Expected state:

- `db` is healthy
- `app` is healthy
- Nuxt answers HTTP requests
- Prisma can query PostgreSQL
- restarting `app` does not alter or reseed the database
- recreating `app` does not delete uploaded files because `uploads_dev` is persistent

## Current limitation

At Milestone M1.3, automated CI has not yet been added. The commands above therefore remain
part of the manual acceptance test. M1.4 will add linting, type checking, automated tests, and
machine-verifiable build checks.
