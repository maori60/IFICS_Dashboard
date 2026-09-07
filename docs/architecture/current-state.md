# IFICS Dashboard — Technical baseline before Milestone 1

Date: 2026-09-07
Baseline branch: `baseline/pre-m1-2026-09-07`
Baseline commit: `d992e66d494d1f46e9ab4f5fbd6c0ce9889e9d64`

## Purpose

This document records the technical state of IFICS Dashboard before the Milestone 1 foundation work and tracks the foundation controls added during M1. It is intentionally factual and is used as a stable reference for future maintenance, security reviews and audits.

## Current stack

- Nuxt 4 / Vue 3
- Nitro server API
- Node.js 22 container image
- Prisma ORM with PostgreSQL adapter
- PostgreSQL 16
- Docker / Docker Compose
- ESLint / TypeScript / Vitest quality toolchain

## Current repository structure

- `app/`: Nuxt pages, layouts and UI components
- `server/api/`: Nitro API routes
- `server/utils/`: shared server utilities
- `prisma/`: schema, migrations and development seed
- `tests/`: automated tests
- `public/`: public static assets
- `docs/`: architecture, development and security documentation
- `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`: production-like local runtime
- `Dockerfile.dev`, `docker-compose.dev.yml`: development runtime

## Existing business capabilities

The current data model and API already cover the foundations of:

- association configuration
- users and roles (data model only; authorization is not yet enforced)
- clients and client contacts
- projects
- external intervenors / service providers
- project assignments
- project documents
- intervenor administrative documents
- quotes and invoices
- project reports

## Security baseline findings

The repository must not be exposed to the public Internet in its current foundation state.

Critical gaps identified before M1 and still applicable where not explicitly remediated:

1. Authentication and secure session management are not implemented.
2. Server routes do not yet enforce authorization, scopes or data classifications.
3. Sensitive intervenor data can currently be returned by API routes without authorization enforcement.
4. Database credentials were stored directly in repository configuration before M1.2; those historical values are considered compromised and must never be reused.
5. File validation trusts the multipart MIME value and requires stronger content validation and malware scanning.
6. Audit logging is not implemented.
7. Existing API behavior still lacks broad regression coverage; this is the purpose of M1.5.
8. Legacy lint debt exists and is explicitly baselined rather than hidden.
9. Development-tooling dependency vulnerabilities remain where npm currently offers only a breaking forced Prisma downgrade; see `docs/development/quality.md`.

## Known defects observed during baseline review

- The project document viewing route queries `intervenorDocument` instead of `projectDocument`.
- A document route exists with a trailing space in its repository filename.
- That route references `archivedAt` on an `IntervenorDocument` model that does not currently define that field.
- Current contract replacement deletes prior contract records/files rather than preserving immutable version history.

These issues are documented before remediation so that corresponding regression tests can be created.

## Positive baseline characteristics

The existing project should be evolved rather than rewritten from scratch because it already provides:

- a useful relational domain model
- Prisma migrations
- PostgreSQL constraints and indexes
- UUID-based stored filenames for several uploads
- soft-archive behavior for some business entities
- a clear Nuxt `app/` / Nitro `server/` separation
- a Dockerized application and database

## M1 controls implemented so far

### M1.1 — Baseline and architecture documentation

- stable pre-M1 branch and commit reference
- factual architecture / security inventory
- known defects recorded before remediation

### M1.2 — Secrets and environment configuration

- committed `.env.example` contains placeholders only
- real credentials removed from current repository configuration
- build-only Prisma placeholder is deliberately non-secret and unreachable
- historical committed values classified as compromised

### M1.3 — Reproducible development Docker environment

- Node.js 22 runtime
- deterministic dependency installation with `npm ci`
- dedicated development Dockerfile and Compose file
- persistent PostgreSQL and upload volumes
- source bind mount for development
- localhost-only development port exposure
- explicit Prisma client generation
- committed migrations applied with `prisma migrate deploy`
- development seed is explicit and never tied to application restart
- runtime entrypoint performs no schema mutation or seed
- Docker smoke test verifies migration, seed, HTTP startup, non-reseeding and upload persistence

See `docs/development/docker.md`.

### M1.4 — Quality and test foundation

- Nuxt ESLint enabled
- current 37-warning legacy lint baseline recorded and capped with `--max-warnings=37`
- Nuxt TypeScript typecheck is blocking
- Vitest + V8 coverage enabled
- first three unit tests cover required environment-variable validation
- coverage thresholds are blocking and the initial utility has 100% coverage
- permanent pull-request `Quality Gate` workflow added
- dependency tree remediated without `npm audit fix --force`
- critical dependency findings removed from the accepted production gate
- Prisma CLI classified as development tooling rather than an application runtime dependency
- complete audit output retained for review

See `docs/development/quality.md`.

## Milestone 1 rule

No M1 capability is considered complete until it has:

1. implementation
2. automated tests
3. negative/security tests where applicable
4. documentation
5. audit evidence or an auditable control description

## Planned M1 sequence

1. M1.1 — baseline and architecture documentation ✅
2. M1.2 — secrets and environment configuration ✅
3. M1.3 — clean development Docker environment ✅
4. M1.4 — lint, typecheck and test foundation — final CI acceptance pending
5. M1.5 — regression tests for existing API
6. M1.6 — validation and error-handling foundation
7. M1.7 — persistent and secure document storage
8. M1.8 — user / roles / permissions model
9. M1.9 — authentication
10. M1.10 — secure sessions
11. M1.11 — MFA and recovery
12. M1.12 — audit log
13. M1.13 — rate limiting and security protections
14. M1.14 — CI
15. M1.15 — staging
16. M1.16 — security/audit baseline
