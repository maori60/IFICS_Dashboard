import { describe, expect, it } from 'vitest'

import {
  validateDatabaseUrl,
  validateEnvironment,
} from '../../scripts/guard-test-database.mjs'

const base = 'postgresql://ifics_test_runner:password@db:5432/ifics_test'

describe('Database safety guard', () => {
  it('rejects the administrative PostgreSQL user', () => {
    expect(() =>
      validateDatabaseUrl(
        'postgresql://ifics_app:password@db:5432/ifics_test',
      ),
    ).toThrow('utilisateur PostgreSQL non autorise')
  })

  it('accepts a canonical test URL', () => {
    expect(validateDatabaseUrl(base).database).toBe('ifics_test')
  })

  it('accepts the migration audit database', () => {
    expect(
      validateDatabaseUrl(
        'postgresql://ifics_test_runner:password@db:5432/ifics_migration_audit',
      ).database,
    ).toBe('ifics_migration_audit')
  })

  const rejected = [
    'postgresql://ifics_test_runner:password@db:5432/ifics',
    'postgresql://ifics_test_runner:password@db:5432/postgres',
    'postgresql://ifics_test_runner:password@example.com:5432/ifics_test',
    'postgresql://db:5432/ifics_test',
    `${base}?host=localhost`,
    `${base}?hostaddr=127.0.0.1`,
    `${base}?service=production`,
    `${base}?schema=private`,
    `${base}?schema=public&schema=private`,
    `${base}#production`,
    'postgresql://ifics_test_runner:password@db:5433/ifics_test',
    'postgresql://ifics_test_runner:password@db:5432/ifics%5Ftest',
  ]

  it.each(rejected)('rejects unsafe URL %#', (url) => {
    expect(() => validateDatabaseUrl(url)).toThrow()
  })

  it('accepts explicit public schema', () => {
    expect(
      validateDatabaseUrl(`${base}?schema=public`).database,
    ).toBe('ifics_test')
  })

  it('rejects a production shadow database', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: base,
        SHADOW_DATABASE_URL:
          'postgresql://ifics_test_runner:password@db:5432/ifics',
      }),
    ).toThrow()
  })

  it('rejects an identical shadow database', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: base,
        SHADOW_DATABASE_URL: base,
      }),
    ).toThrow()
  })
})
