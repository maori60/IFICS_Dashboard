# M1.4 — Quality and test baseline

## Purpose

Milestone 1.4 establishes a reproducible quality gate before adding broader API regression tests.
The goal is not to rewrite business code during this foundation step, but to make new quality debt
measurable and prevent regressions from silently entering the branch.

## Supported runtime

- Node.js 22
- deterministic dependency installation with `npm ci`
- Nuxt 4.5.2 or a compatible version allowed by the committed lockfile
- Prisma client / adapter 7.10.0 or a compatible version allowed by the committed lockfile
- Prisma CLI classified as development tooling, not an application runtime dependency

## Local quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run quality
```

`npm run quality` executes lint, type checking and tests with coverage in sequence.

## ESLint baseline

Nuxt ESLint is enabled through `@nuxt/eslint`.

The existing project contained 37 lint warnings when M1.4 introduced the gate:

- 30 `@typescript-eslint/no-explicit-any` warnings
- 7 `vue/html-self-closing` warnings

There are no lint errors in the accepted M1.4 baseline.

The lint command is deliberately configured with:

```text
--max-warnings=37
```

This is a ratchet, not a target. Existing debt is visible but temporarily tolerated; a change that
introduces a 38th warning fails CI. The warning ceiling should only move downward as legacy typing
and template cleanup are completed.

## Type checking

The project uses Nuxt's generated TypeScript configuration and validates the application with:

```bash
nuxt typecheck
```

Type checking is a blocking CI step.

## Unit test foundation

Vitest 5 with V8 coverage is configured in `vitest.config.ts`.

The first unit-tested foundation utility is `server/utils/env.ts`, which centralizes required
environment-variable validation through `requireEnv()`.

The initial tests cover:

1. returning a configured value after trimming whitespace
2. rejecting an absent required variable
3. rejecting a whitespace-only required variable

At M1.4 acceptance, these three tests pass and the utility has 100% statement, branch, function and
line coverage.

Configured minimum coverage thresholds for the currently covered foundation code are:

- statements: 80%
- branches: 75%
- functions: 80%
- lines: 80%

Coverage scope will expand as M1.5 adds API regression tests. Thresholds must not be weakened to make
a failing change pass without a documented engineering reason.

## CI quality gate

`.github/workflows/quality.yml` runs on pull requests and can also be invoked manually.

It verifies, in order:

1. Node.js 22
2. deterministic `npm ci`
3. Prisma client generation
4. ESLint baseline
5. Nuxt TypeScript type checking
6. Vitest unit tests with coverage thresholds
7. absence of critical vulnerabilities in production dependencies
8. a complete informational dependency audit

A failure in the blocking steps means the milestone or pull request is not accepted.

## Dependency security remediation performed in M1.4

The M1.3 deterministic install initially reported 30 npm audit findings:

- 4 low
- 6 moderate
- 16 high
- 4 critical

After the M1.4 quality toolchain was added, the tree reported 28 findings. Controlled remediation was
then performed without `npm audit fix --force`.

The remediation included upgrading the root dependency ranges to the secure compatible line used by
the final lockfile, including:

- Nuxt 4.5.2+
- Prisma client / adapter / CLI 7.10.0+

Safe transitive fixes were also applied. The critical findings involving Nuxt DevTools, `seroval`,
`shell-quote` and `tar` were removed.

The Prisma CLI was subsequently moved from `dependencies` to `devDependencies`. The running IFICS
application does not execute the Prisma CLI: the runtime entrypoint validates `DATABASE_URL` and
starts the built Nuxt/Nitro server. Prisma CLI remains available during development, client
generation, migration operations and image build steps.

## Remaining dependency debt

After all non-breaking remediations, the complete development dependency audit still reports four
high-severity findings through Prisma tooling dependencies:

- `deepmerge-ts` through `@prisma/config`
- `mysql2` through `@prisma/config` / Prisma CLI

At the time of M1.4, npm proposes remediation only through `npm audit fix --force`, which would
install Prisma 6.19.3 and therefore perform a breaking major-version downgrade from Prisma 7.

That forced downgrade is explicitly rejected. These findings are tracked as development-tooling
security debt and must be reviewed again when Prisma publishes a compatible dependency path or when
the Prisma tooling architecture is revisited.

The production dependency gate is stricter about impact: critical production vulnerabilities are
blocking. Prisma CLI development-only findings must not be misrepresented as application runtime
dependencies.

## Security rules

- never use `npm audit fix --force` automatically
- never accept a breaking dependency change merely to make an audit counter reach zero
- production critical findings block CI
- complete audit output remains visible for review
- dependency updates must be followed by lint, typecheck, unit tests and Docker smoke tests

## Acceptance criteria

M1.4 is complete only when the same final branch HEAD has both:

1. a green `Quality Gate`
2. a green `Docker Dev Smoke`

The Docker smoke test is retained from M1.3 to prove that quality/dependency changes did not break
Prisma generation, committed migrations, development seed, HTTP startup, database non-reseeding,
upload persistence, Compose validation or the production-like image build.

## Next step

M1.5 will add regression tests around the existing API behavior and known baseline defects before
security-sensitive business logic is refactored further.
