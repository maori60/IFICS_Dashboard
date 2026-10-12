import { describe, expect, it } from 'vitest'
import { officialReportArchiveEnabled } from '../../server/utils/report-archive-activation'

const devUrl = 'postgresql://user:password@db:5432/ifics'
const testUrl = 'postgresql://user:password@db:5432/ifics_test'

describe('Activation contrôlée des archives officielles', () => {
  it('reste désactivée par défaut', () => {
    expect(officialReportArchiveEnabled({})).toBe(false)
  })

  it('refuse une activation incomplète', () => {
    expect(officialReportArchiveEnabled({
      IFICS_REPORT_OFFICIAL_ARCHIVE: 'enabled',
      DATABASE_URL: devUrl,
    })).toBe(false)
  })

  it('autorise la base isolée uniquement en contexte de test', () => {
    const env = {
      IFICS_REPORT_OFFICIAL_ARCHIVE: 'enabled',
      DATABASE_URL: testUrl,
      REPORT_INTEGRATION_TESTS: '1',
      NODE_ENV: 'test',
    }

    expect(officialReportArchiveEnabled(env)).toBe(true)
    expect(officialReportArchiveEnabled({
      ...env,
      NODE_ENV: 'development',
    })).toBe(false)
    expect(officialReportArchiveEnabled({
      ...env,
      REPORT_INTEGRATION_TESTS: '0',
    })).toBe(false)
  })

  it('exige une confirmation explicite pour la base principale', () => {
    const env = {
      IFICS_REPORT_OFFICIAL_ARCHIVE: 'enabled',
      DATABASE_URL: devUrl,
      IFICS_REPORT_ARCHIVE_SCHEMA_READY: 'confirmed',
    }

    expect(officialReportArchiveEnabled(env)).toBe(true)
    expect(officialReportArchiveEnabled({
      ...env,
      IFICS_REPORT_ARCHIVE_SCHEMA_READY: 'pending',
    })).toBe(false)
  })

  it('refuse les URL invalides et les bases inconnues', () => {
    const env = {
      IFICS_REPORT_OFFICIAL_ARCHIVE: 'enabled',
      IFICS_REPORT_ARCHIVE_SCHEMA_READY: 'confirmed',
    }

    expect(officialReportArchiveEnabled({
      ...env,
      DATABASE_URL: 'invalid-url',
    })).toBe(false)

    expect(officialReportArchiveEnabled({
      ...env,
      DATABASE_URL: 'postgresql://user:password@db:5432/unknown',
    })).toBe(false)

    expect(officialReportArchiveEnabled({
      ...env,
      DATABASE_URL: 'mysql://user:password@db:3306/ifics',
    })).toBe(false)
  })
})
