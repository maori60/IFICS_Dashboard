import { describe, expect, it } from 'vitest'
import {
  reportArchiveStateMatches,
  type ReportArchiveGuardState,
} from '../../server/utils/report-archive-guard'

function fixture(): ReportArchiveGuardState {
  return {
    status: 'SUBMITTED',
    currentVersion: 3,
    updatedAt: new Date('2026-10-10T15:00:00.000Z'),
    versionId: 'version-3',
    versionContent: 'Contenu pédagogique.',
    title: 'Atelier numérique',
    sessionDate: new Date('2026-10-09T12:00:00.000Z'),
    startTime: '09:30',
    endTime: '12:00',
    studentsCount: 4,
    projectTitle: 'Projet pédagogique',
    associationName: 'IFICS',
    intervenorName: 'Personne intervenante',
  }
}

describe('Garde de concurrence des archives', () => {
  it('accepte deux états soumis identiques', () => {
    expect(
      reportArchiveStateMatches(fixture(), fixture()),
    ).toBe(true)
  })

  it('refuse un état initial non soumis', () => {
    const expected = fixture()
    expected.status = 'VALIDATED'

    expect(
      reportArchiveStateMatches(expected, fixture()),
    ).toBe(false)
  })

  it('refuse un état actuel non soumis', () => {
    const actual = fixture()
    actual.status = 'REFUSED'

    expect(
      reportArchiveStateMatches(fixture(), actual),
    ).toBe(false)
  })

  it.each([
    ['currentVersion', 4],
    ['versionId', 'version-4'],
    ['versionContent', 'Contenu modifié'],
    ['title', 'Autre atelier'],
    ['startTime', '10:00'],
    ['endTime', '13:00'],
    ['studentsCount', 5],
    ['projectTitle', 'Autre projet'],
    ['associationName', 'Autre association'],
    ['intervenorName', 'Autre personne'],
  ] as const)(
    'détecte une modification de %s',
    (field, value) => {
      const actual = fixture()
      Object.assign(actual, { [field]: value })

      expect(
        reportArchiveStateMatches(fixture(), actual),
      ).toBe(false)
    },
  )

  it('détecte une modification de updatedAt', () => {
    const actual = fixture()
    actual.updatedAt = new Date(
      '2026-10-10T15:00:00.001Z',
    )

    expect(
      reportArchiveStateMatches(fixture(), actual),
    ).toBe(false)
  })

  it('détecte une modification de sessionDate', () => {
    const actual = fixture()
    actual.sessionDate = new Date(
      '2026-10-10T12:00:00.000Z',
    )

    expect(
      reportArchiveStateMatches(fixture(), actual),
    ).toBe(false)
  })

  it('accepte les champs optionnels identiques à null', () => {
    const expected = fixture()

    expected.title = null
    expected.startTime = null
    expected.endTime = null
    expected.studentsCount = null
    expected.intervenorName = null

    const actual = {
      ...expected,
      updatedAt: new Date(expected.updatedAt),
      sessionDate: new Date(expected.sessionDate),
    }

    expect(
      reportArchiveStateMatches(expected, actual),
    ).toBe(true)
  })
})
