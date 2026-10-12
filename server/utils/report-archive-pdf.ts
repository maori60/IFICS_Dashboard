import { generateReportPdf } from './pdf'

export type OfficialReportPdfSnapshot =
  ReturnType<typeof import('./report-archive-snapshot').buildReportArchiveSnapshot>

export function officialReportPdfInput(
  snapshot: OfficialReportPdfSnapshot,
) {
  return {
    title: snapshot.reportTitle,
    projectTitle: snapshot.projectTitle,
    intervenorName: snapshot.intervenorName,
    sessionDate: snapshot.sessionDate,
    startTime: snapshot.startTime,
    endTime: snapshot.endTime,
    studentsCount: snapshot.studentsCount,
    content: snapshot.content,
    version: snapshot.version,
    associationName: snapshot.associationName,
    official: {
      reference: snapshot.reference,
      validatedAt: snapshot.validatedAt,
    },
  }
}

export async function generateOfficialReportPdf(
  snapshot: OfficialReportPdfSnapshot,
): Promise<Uint8Array> {
  return generateReportPdf(officialReportPdfInput(snapshot))
}
