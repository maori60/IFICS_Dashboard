import type { ReportArchiveSource } from './report-archive-reader'
import type { ReportArchiveGuardState } from './report-archive-guard'

export function reportArchiveStateFromSource(
  source: ReportArchiveSource,
): ReportArchiveGuardState {
  const version = source.versions[0]

  if (
    source.status !== 'SUBMITTED'
    || !Number.isSafeInteger(source.currentVersion)
    || source.currentVersion < 1
    || !version
    || version.version !== source.currentVersion
  ) {
    throw new Error(
      'Le bilan soumis ne possède pas de version cohérente.',
    )
  }

  const intervenorName = source.intervenor
    ? [
        source.intervenor.firstName,
        source.intervenor.lastName,
      ].filter(Boolean).join(' ').trim() || null
    : null

  return {
    status: source.status,
    currentVersion: source.currentVersion,
    updatedAt: new Date(source.updatedAt.getTime()),
    versionId: version.id,
    versionContent: version.content,
    title: source.title,
    sessionDate: new Date(source.sessionDate.getTime()),
    startTime: source.startTime,
    endTime: source.endTime,
    studentsCount: source.studentsCount,
    projectTitle: source.project.title,
    associationName: source.project.association.name,
    intervenorName,
  }
}
