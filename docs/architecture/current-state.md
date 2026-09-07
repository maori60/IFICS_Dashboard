# IFICS Dashboard — Technical baseline before Milestone 1

Date: 2026-09-07
Baseline branch: `baseline/pre-m1-2026-09-07`
Baseline commit: `d992e66d494d1f46e9ab4f5fbd6c0ce9889e9d64`

## Purpose

This document records the technical state of IFICS Dashboard before the Milestone 1 foundation work. It is intentionally factual and is used as a stable reference for future maintenance, security reviews and audits.

## Current stack

- Nuxt 4 / Vue 3
- Nitro server API
- Node.js 22 container image
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
9. Development seed / `prisma db push` ran from the application entrypoint. **Removed in M1.3. Container restart is now non-mutating; Prisma generation, migrations and seed are explicit operations.**
10. The dependency baseline observed during M1.3 reports **30 npm audit findings (4 low, 6 moderate, 16 high, 4 critical)**. These findings are not being auto-fixed blindly. M1.4 will capture and triage the affected dependency paths before upgrades or mitigations are selected.

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
6. Prisma client generation and development seed are explicit bootstrap/operator actions.
7. The development application source is bind-mounted for Nuxt hot reload while dependencies remain in a named volume.
8. Generated Prisma client output is excluded from Docker build context so the release image always generates from the versioned schema.
9. Node.js 22 is the supported runtime for this foundation because current direct/transitive dependencies require Node 22 or newer.
10. A Docker smoke workflow validates Compose syntax, image build, Prisma generation, migrations, seed, HTTP readiness, non-mutating restart behavior and upload-volume persistence.

Detailed operator instructions are in `docs/development/docker.md`.

## M1.3 test evidence

The initial smoke test deliberately failed and exposed a stale `package-lock.json` plus Node 20 incompatibility with current dependencies. The lockfile was regenerated in a controlled Node 22 environment and the runtime was aligned to Node 22.

A subsequent run successfully validated development image build, PostgreSQL startup and all four committed Prisma migrations. It then exposed a missing generated Prisma client before seed execution; the bootstrap order was corrected to `generate → migrate → seed → start`.

The next complete smoke run passed all infrastructure assertions, including HTTP readiness, upload persistence and proof that application recreation does not rerun the seed. A final smoke run is used after M1.3's last Docker-context changes so the final tested commit remains auditable.

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
