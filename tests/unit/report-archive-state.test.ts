import { describe, expect, it } from 'vitest'
import type { ReportArchiveSource } from '../../server/utils/report-archive-reader'
import { reportArchiveStateFromSource } from '../../server/utils/report-archive-state'
import { reportArchiveStateMatches } from '../../server/utils/report-archive-guard'

function fixture(): ReportArchiveSource {
  return {
    id: 'report-1',
    projectId: 'project-1',
    title: 'Atelier numérique',
    status: 'SUBMITTED',
    currentVersion: 3,
    updatedAt: new Date('2026-10-10T14:00:00.000Z'),
    sessionDate: new Date('2026-10-09T12:00:00.000Z'),
    startTime: '09:30',
    endTime: '12:00',
    studentsCount: 4,
    project: {
      title: 'Projet pédagogique',
      association: { name: 'IFICS' },
    },
    intervenor: {
      firstName: 'Alex',
      lastName: 'Martin',
    },
    versions: [{
      id: 'version-3',
      version: 3,
      content: 'Contenu original.',
    }],
  }
}

describe('État de concurrence des archives', () => {
  it('convertit correctement les données Prisma', () => {
    const state = reportArchiveStateFromSource(fixture())

    expect(state).toMatchObject({
      status: 'SUBMITTED',
      currentVersion: 3,
      versionId: 'version-3',
      versionContent: 'Contenu original.',
      title: 'Atelier numérique',
      startTime: '09:30',
      endTime: '12:00',
      studentsCount: 4,
      projectTitle: 'Projet pédagogique',
      associationName: 'IFICS',
      intervenorName: 'Alex Martin',
    })
  })

  it('accepte un bilan sans intervenant', () => {
    const source = fixture()
    source.intervenor = null

    expect(
      reportArchiveStateFromSource(source).intervenorName,
    ).toBeNull()
  })

  it('préserve les champs facultatifs', () => {
    const source = fixture()
    source.title = null
    source.startTime = null
    source.endTime = null
    source.studentsCount = null

    const state = reportArchiveStateFromSource(source)

    expect(state.title).toBeNull()
    expect(state.startTime).toBeNull()
    expect(state.endTime).toBeNull()
    expect(state.studentsCount).toBeNull()
  })

  it('copie les dates sans partager leurs références', () => {
    const source = fixture()
    const state = reportArchiveStateFromSource(source)

    expect(state.updatedAt).toEqual(source.updatedAt)
    expect(state.sessionDate).toEqual(source.sessionDate)
    expect(state.updatedAt).not.toBe(source.updatedAt)
    expect(state.sessionDate).not.toBe(source.sessionDate)
  })

  it('fonctionne avec la garde de concurrence', () => {
    const source = fixture()
    const expected = reportArchiveStateFromSource(source)
    const actual = reportArchiveStateFromSource(source)

    expect(reportArchiveStateMatches(expected, actual)).toBe(true)

    actual.versionContent = 'Modification concurrente'

    expect(reportArchiveStateMatches(expected, actual)).toBe(false)
  })

  it.each([
    ['status', 'VALIDATED'],
    ['currentVersion', 0],
    ['currentVersion', -1],
  ] as const)(
    'refuse un état incohérent : %s',
    (field, value) => {
      const source = fixture()
      Object.assign(source, { [field]: value })

      expect(() => reportArchiveStateFromSource(source))
        .toThrow('version cohérente')
    },
  )

  it('refuse une version manquante', () => {
    const source = fixture()
    source.versions = []

    expect(() => reportArchiveStateFromSource(source))
      .toThrow('version cohérente')
  })

  it('refuse une version différente', () => {
    const source = fixture()
    source.versions[0]!.version = 2

    expect(() => reportArchiveStateFromSource(source))
      .toThrow('version cohérente')
  })
})
