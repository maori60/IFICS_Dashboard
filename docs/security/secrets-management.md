# Secrets management baseline

## Status

Applies from Milestone 1.2 onward.

## Fundamental rule

No credential, API key, session secret, MFA secret, recovery token or production connection string may be committed to Git.

Values that have ever appeared in Git history must be treated as compromised and must not be reused.

## Local development

Developers copy:

```bash
cp .env.example .env
```

and replace every placeholder locally.

`.env` and `.env.*` are ignored by Git, with `.env.example` being the only allowed environment template.

## Required current variables

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `APP_PORT` (optional; defaults to 3000)

## Password requirements for infrastructure secrets

For development, generate a unique random password instead of using a human memorable password.

For staging and production:

- use a unique secret per environment
- never reuse development secrets
- use high-entropy generated values
- rotate secrets after suspected disclosure
- document rotation procedures without documenting the secret itself

## Git history warning

Before M1.2, PostgreSQL credentials were committed to repository configuration. Removing them from the current tree does not remove them from Git history.

Therefore the previous values are permanently classified as compromised and must never be used for staging or production.

A later security-hardening task may rewrite repository history if there is a concrete need, but secret rotation remains mandatory because history rewriting cannot make an already disclosed secret trustworthy again.

## Future production direction

Production secret storage will be selected during the infrastructure milestone. The application code must consume secrets only through runtime configuration and must not depend on a specific secret-management vendor.

## Audit evidence

An auditor should be able to verify:

1. `.env` is ignored by Git.
2. `.env.example` contains placeholders only.
3. repository configuration contains no live credentials.
4. staging and production secrets are distinct from development secrets.
5. documented rotation procedures exist.
6. secret-scanning CI is enabled once M1.14 is implemented.
