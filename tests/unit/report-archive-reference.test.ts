import { describe, expect, it } from 'vitest'
import { generateReportArchiveReference } from '../../server/utils/report-archive-reference'

describe('Références officielles des bilans', () => {
  it('respecte le format attendu', () => {
    const reference = generateReportArchiveReference(
      new Date('2026-10-10T12:00:00.000Z'),
    )

    expect(reference).toMatch(
      /^IFICS-BILAN-2026-[A-F0-9]{24}$/,
    )
    expect(reference.length).toBeLessThanOrEqual(120)
  })

  it('utilise l’année UTC de validation', () => {
    const reference = generateReportArchiveReference(
      new Date('2027-01-01T00:30:00.000Z'),
    )

    expect(reference).toMatch(/^IFICS-BILAN-2027-/)
  })

  it('génère des références distinctes', () => {
    const date = new Date('2026-10-10T12:00:00.000Z')

    const references = Array.from(
      { length: 1000 },
      () => generateReportArchiveReference(date),
    )

    expect(new Set(references).size).toBe(1000)
  })

  it('rejette une date invalide', () => {
    expect(() =>
      generateReportArchiveReference(new Date('invalid')),
    ).toThrow('Date de validation invalide')
  })
})
