import type { ReportArchiveSource } from './report-archive-reader'
import { buildReportArchiveSnapshot } from './report-archive-snapshot'

export function buildReportArchiveFromSource(
  source: ReportArchiveSource,
  validatedByUserId: string,
  validatedAt: Date,
) {
  const version = source.versions[0]

  if (
    source.status !== 'SUBMITTED'
    || source.currentVersion < 1
    || !version
    || version.version !== source.currentVersion
  ) {
    throw new Error(
      'Le bilan soumis ne possède pas de version officielle cohérente.',
    )
  }

  const intervenorName = source.intervenor
    ? [
        source.intervenor.firstName,
        source.intervenor.lastName,
      ].filter(Boolean).join(' ').trim() || null
    : null

  return buildReportArchiveSnapshot({
    reportId: source.id,
    reportVersionId: version.id,
    version: version.version,
    associationName: source.project.association.name,
    projectTitle: source.project.title,
    reportTitle: source.title?.trim() || 'Bilan de séance',
    intervenorName,
    sessionDate: source.sessionDate,
    startTime: source.startTime,
    endTime: source.endTime,
    studentsCount: source.studentsCount,
    content: version.content,
    validatedByUserId,
    validatedAt,
  })
}
