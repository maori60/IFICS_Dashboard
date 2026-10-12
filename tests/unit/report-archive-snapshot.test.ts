import { describe, expect, it } from 'vitest'
import {
  buildReportArchiveSnapshot,
  type ReportArchiveSnapshotInput,
} from '../../server/utils/report-archive-snapshot'

function validInput(): ReportArchiveSnapshotInput {
  return {
    reportId: 'report-123',
    reportVersionId: 'version-456',
    version: 2,
    associationName: 'IFICS',
    projectTitle: 'Projet éducatif',
    reportTitle: 'Atelier numérique',
    intervenorName: 'Personne intervenante',
    sessionDate: new Date('2026-10-09T12:00:00.000Z'),
    startTime: '09:30',
    endTime: '12:00',
    studentsCount: 4,
    content: 'Contenu exact du bilan.',
    validatedByUserId: 'user-789',
    validatedAt: new Date('2026-10-10T15:00:00.000Z'),
  }
}

describe('Instantané des bilans officiels', () => {
  it('conserve les informations de la version validée', () => {
    const input = validInput()
    const snapshot = buildReportArchiveSnapshot(input)

    expect(snapshot).toMatchObject({
      reportId: 'report-123',
      reportVersionId: 'version-456',
      version: 2,
      associationName: 'IFICS',
      projectTitle: 'Projet éducatif',
      reportTitle: 'Atelier numérique',
      intervenorName: 'Personne intervenante',
      startTime: '09:30',
      endTime: '12:00',
      studentsCount: 4,
      content: 'Contenu exact du bilan.',
      validatedByUserId: 'user-789',
    })

    expect(snapshot.reference).toMatch(
      /^IFICS-BILAN-2026-[A-F0-9]{24}$/,
    )
  })

  it('copie les dates sans conserver leurs références', () => {
    const input = validInput()
    const originalSessionDate = input.sessionDate.getTime()
    const originalValidatedAt = input.validatedAt.getTime()

    const snapshot = buildReportArchiveSnapshot(input)

    input.sessionDate.setUTCFullYear(2030)
    input.validatedAt.setUTCFullYear(2030)

    expect(snapshot.sessionDate.getTime()).toBe(originalSessionDate)
    expect(snapshot.validatedAt.getTime()).toBe(originalValidatedAt)
    expect(snapshot.sessionDate).not.toBe(input.sessionDate)
    expect(snapshot.validatedAt).not.toBe(input.validatedAt)
  })

  it('accepte un bilan sans intervenant ni horaires', () => {
    const snapshot = buildReportArchiveSnapshot({
      ...validInput(),
      intervenorName: null,
      startTime: null,
      endTime: null,
      studentsCount: null,
    })

    expect(snapshot.intervenorName).toBeNull()
    expect(snapshot.startTime).toBeNull()
    expect(snapshot.endTime).toBeNull()
    expect(snapshot.studentsCount).toBeNull()
  })

  it('conserve zéro participant sans le remplacer par null', () => {
    const snapshot = buildReportArchiveSnapshot({
      ...validInput(),
      studentsCount: 0,
    })

    expect(snapshot.studentsCount).toBe(0)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejette une version invalide : %s',
    (version) => {
      expect(() => buildReportArchiveSnapshot({
        ...validInput(),
        version,
      })).toThrow('Données du bilan officiel invalides')
    },
  )

  it('rejette les informations obligatoires manquantes', () => {
    expect(() => buildReportArchiveSnapshot({
      ...validInput(),
      associationName: '   ',
    })).toThrow('Données du bilan officiel invalides')

    expect(() => buildReportArchiveSnapshot({
      ...validInput(),
      reportVersionId: '',
    })).toThrow('Données du bilan officiel invalides')
  })

  it('rejette une date de séance invalide', () => {
    expect(() => buildReportArchiveSnapshot({
      ...validInput(),
      sessionDate: new Date('invalid'),
    })).toThrow('Données du bilan officiel invalides')
  })

  it('rejette une date de validation invalide', () => {
    expect(() => buildReportArchiveSnapshot({
      ...validInput(),
      validatedAt: new Date('invalid'),
    })).toThrow('Données du bilan officiel invalides')
  })
})
