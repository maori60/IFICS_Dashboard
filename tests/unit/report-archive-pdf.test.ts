import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildReportArchiveSnapshot } from '../../server/utils/report-archive-snapshot'
import {
  generateOfficialReportPdf,
  officialReportPdfInput,
} from '../../server/utils/report-archive-pdf'

function fixture() {
  return buildReportArchiveSnapshot({
    reportId: 'report-test',
    reportVersionId: 'version-test',
    version: 3,
    associationName: 'IFICS',
    projectTitle: 'Projet pédagogique',
    reportTitle: 'Atelier numérique',
    intervenorName: 'Personne intervenante',
    sessionDate: new Date('2026-10-09T12:00:00.000Z'),
    startTime: '09:30',
    endTime: '12:00',
    studentsCount: 4,
    content: 'Contenu pédagogique officiel.',
    validatedByUserId: 'admin-test',
    validatedAt: new Date('2026-10-10T15:00:00.000Z'),
  })
}

describe('Adaptateur PDF officiel des bilans', () => {
  it('transmet toutes les données pédagogiques', () => {
    const snapshot = fixture()
    const input = officialReportPdfInput(snapshot)

    expect(input).toMatchObject({
      title: snapshot.reportTitle,
      projectTitle: snapshot.projectTitle,
      intervenorName: snapshot.intervenorName,
      startTime: snapshot.startTime,
      endTime: snapshot.endTime,
      studentsCount: snapshot.studentsCount,
      content: snapshot.content,
      version: snapshot.version,
      associationName: snapshot.associationName,
    })

    expect(input.sessionDate).toEqual(snapshot.sessionDate)
  })

  it('transmet la référence et la date officielles', () => {
    const snapshot = fixture()
    const input = officialReportPdfInput(snapshot)

    expect(input.official.reference).toBe(snapshot.reference)
    expect(input.official.validatedAt).toEqual(snapshot.validatedAt)
  })

  it('génère un PDF officiel valide', async () => {
    const snapshot = fixture()
    const bytes = await generateOfficialReportPdf(snapshot)

    expect(bytes.length).toBeGreaterThan(100)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')

    const document = await PDFDocument.load(bytes)
    expect(document.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('accepte un bilan sans intervenant ni horaires', async () => {
    const snapshot = buildReportArchiveSnapshot({
      ...fixture(),
      intervenorName: null,
      startTime: null,
      endTime: null,
      studentsCount: null,
    })

    const input = officialReportPdfInput(snapshot)

    expect(input.intervenorName).toBeNull()
    expect(input.startTime).toBeNull()
    expect(input.endTime).toBeNull()
    expect(input.studentsCount).toBeNull()

    const bytes = await generateOfficialReportPdf(snapshot)
    const document = await PDFDocument.load(bytes)

    expect(document.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})
