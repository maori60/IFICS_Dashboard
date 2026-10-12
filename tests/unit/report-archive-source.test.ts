import { describe, expect, it } from 'vitest'
import type { ReportArchiveSource } from '../../server/utils/report-archive-reader'
import { buildReportArchiveFromSource } from '../../server/utils/report-archive-source'

const validatedAt = new Date('2026-10-10T15:00:00.000Z')

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
      association: {
        name: 'IFICS',
      },
    },
    intervenor: {
      firstName: 'Alex',
      lastName: 'Martin',
    },
    versions: [{
      id: 'version-3',
      version: 3,
      content: 'Contenu pédagogique original.',
    }],
  }
}

describe('Transformation du bilan en archive officielle', () => {
  it('conserve les informations historiques', () => {
    const source = fixture()

    const snapshot = buildReportArchiveFromSource(
      source,
      'admin-1',
      validatedAt,
    )

    expect(snapshot).toMatchObject({
      reportId: 'report-1',
      reportVersionId: 'version-3',
      version: 3,
      associationName: 'IFICS',
      projectTitle: 'Projet pédagogique',
      reportTitle: 'Atelier numérique',
      intervenorName: 'Alex Martin',
      startTime: '09:30',
      endTime: '12:00',
      studentsCount: 4,
      content: 'Contenu pédagogique original.',
      validatedByUserId: 'admin-1',
    })

    expect(snapshot.sessionDate).toEqual(source.sessionDate)
    expect(snapshot.validatedAt).toEqual(validatedAt)
    expect(snapshot.reference).toMatch(/^IFICS-BILAN-2026-[A-F0-9]{24}$/)
  })

  it('accepte un bilan créé sans intervenant', () => {
    const source = fixture()
    source.intervenor = null
    source.startTime = null
    source.endTime = null
    source.studentsCount = null

    const snapshot = buildReportArchiveFromSource(
      source,
      'admin-1',
      validatedAt,
    )

    expect(snapshot.intervenorName).toBeNull()
    expect(snapshot.startTime).toBeNull()
    expect(snapshot.endTime).toBeNull()
    expect(snapshot.studentsCount).toBeNull()
  })

  it('utilise un titre par défaut si nécessaire', () => {
    const source = fixture()
    source.title = '  '

    const snapshot = buildReportArchiveFromSource(
      source,
      'admin-1',
      validatedAt,
    )

    expect(snapshot.reportTitle).toBe('Bilan de séance')
  })

  it('refuse un bilan non soumis', () => {
    const source = fixture()
    source.status = 'VALIDATED'

    expect(() => buildReportArchiveFromSource(
      source,
      'admin-1',
      validatedAt,
    )).toThrow('version officielle cohérente')
  })

  it('refuse un bilan sans version', () => {
    const source = fixture()
    source.versions = []

    expect(() => buildReportArchiveFromSource(
      source,
      'admin-1',
      validatedAt,
    )).toThrow('version officielle cohérente')
  })

  it('refuse une version différente de la version courante', () => {
    const source = fixture()
    source.currentVersion = 4

    expect(() => buildReportArchiveFromSource(
      source,
      'admin-1',
      validatedAt,
    )).toThrow('version officielle cohérente')
  })

  it('refuse une version courante égale à zéro', () => {
    const source = fixture()
    source.currentVersion = 0

    expect(() => buildReportArchiveFromSource(
      source,
      'admin-1',
      validatedAt,
    )).toThrow('version officielle cohérente')
  })

  it('préserve exactement le contenu pédagogique', () => {
    const source = fixture()
    source.versions[0]!.content = 'Ligne 1\n\nLigne 2 — accents éèà.'

    const snapshot = buildReportArchiveFromSource(
      source,
      'admin-1',
      validatedAt,
    )

    expect(snapshot.content).toBe(source.versions[0]!.content)
  })

  it('ne modifie pas les dates du bilan source', () => {
    const source = fixture()

    const snapshot = buildReportArchiveFromSource(
      source,
      'admin-1',
      validatedAt,
    )

    expect(snapshot.sessionDate).not.toBe(source.sessionDate)
    expect(snapshot.validatedAt).not.toBe(validatedAt)
    expect(snapshot.sessionDate).toEqual(source.sessionDate)
    expect(snapshot.validatedAt).toEqual(validatedAt)
  })
})
