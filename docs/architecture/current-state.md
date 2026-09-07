# IFICS Dashboard — Technical baseline before Milestone 1

Date: 2026-09-07
Baseline branch: `baseline/pre-m1-2026-09-07`
Baseline commit: `d992e66d494d1f46e9ab4f5fbd6c0ce9889e9d64`

## Purpose

This document records the technical state of IFICS Dashboard before the Milestone 1 foundation work. It is intentionally factual and is used as a stable reference for future maintenance, security reviews and audits.

## Current stack

- Nuxt 4 / Vue 3
- Nitro server API
- Node.js 20 container image
- Prisma ORM with PostgreSQL adapter
- PostgreSQL 16
- Docker / Docker Compose

## Current repository structure

- `app/`: Nuxt pages, layouts and UI components
- `server/api/`: Nitro API routes
- `server/utils/`: shared server utilities
- `prisma/`: schema, migrations and development seed
- `public/`: public static assets
- `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`: production-like local runtime
- `Dockerfile.dev`, `docker-compose.dev.yml`: isolated development runtime added in M1.3
- `docs/`: architecture, development and security documentation

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

The repository must not be exposed to the public Internet in its current baseline state.

Critical gaps identified before M1:

1. Authentication and secure session management are not implemented.
2. Server routes do not yet enforce authorization, scopes or data classifications.
3. Sensitive intervenor data can currently be returned by API routes without authorization enforcement.
4. Database credentials were stored directly in repository configuration before M1.2. **Remediated in working tree; historical values remain compromised and must never be reused.**
5. Uploaded documents were stored inside the application container without a dedicated persistent Docker volume. **Development and production-like local stacks now mount dedicated upload volumes in M1.3. Secure document storage design remains scheduled for M1.7.**
6. File validation trusts the multipart MIME value and requires stronger content validation and malware scanning.
7. Audit logging is not implemented.
8. Automated application tests are not yet implemented. A Docker development smoke workflow was introduced in M1.3 as the first machine-verifiable infrastructure test.
9. Development seed / `prisma db push` ran from the application entrypoint. **Removed in M1.3. Container restart is now non-mutating; migrations and seed are explicit operations.**

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

## M1.3 architecture decisions

M1.3 establishes the following Docker rules:

1. Development and production-like local execution are separate Compose definitions.
2. Development services bind to `127.0.0.1` by default to avoid accidental LAN/Internet exposure.
3. PostgreSQL data and uploaded files use named persistent volumes.
4. Restarting the application container must not run `prisma db push`, migrations or seed automatically.
5. Schema changes are applied only through committed Prisma migrations.
6. Development seed is an explicit operator action.
7. The development application source is bind-mounted for Nuxt hot reload while dependencies remain in a named volume.
8. A Docker smoke workflow validates Compose syntax, image build, migrations, seed, HTTP readiness and upload-volume persistence.

Detailed operator instructions are in `docs/development/docker.md`.

## Milestone 1 rule

No M1 capability is considered complete until it has:

1. implementation
2. automated tests
3. negative/security tests where applicable
4. documentation
5. audit evidence or an auditable control description

## Planned M1 sequence

1. M1.1 — baseline and architecture documentation
2. M1.2 — secrets and environment configuration
3. M1.3 — clean development Docker environment
4. M1.4 — lint, typecheck and test foundation
5. M1.5 — regression tests for existing API
6. M1.6 — validation and error-handling foundation
7. M1.7 — persistent and secure document storage
8. M1.8 — user / roles / permissions model
9. M1.9 — authentication
10. M1.10 — secure sessions
11. M1.11 — MFA and recovery
12. M1.12 — audit log
13. M1.13 — rate limiting and security protections
14. M1.14 — CI hardening and deployment gates
15. M1.15 — staging
16. M1.16 — security/audit baseline
