import { generateReportArchiveReference } from './report-archive-reference'

export type ReportArchiveSnapshotInput = {
  reportId: string
  reportVersionId: string
  version: number
  associationName: string
  projectTitle: string
  reportTitle: string
  intervenorName?: string | null
  sessionDate: Date
  startTime?: string | null
  endTime?: string | null
  studentsCount?: number | null
  content: string
  validatedByUserId: string
  validatedAt: Date
}

export function buildReportArchiveSnapshot(
  input: ReportArchiveSnapshotInput,
) {
  if (
    !input.reportId
    || !input.reportVersionId
    || !Number.isSafeInteger(input.version)
    || input.version < 1
    || !input.associationName.trim()
    || !input.projectTitle.trim()
    || !input.reportTitle.trim()
    || !input.validatedByUserId
    || Number.isNaN(input.sessionDate.getTime())
    || Number.isNaN(input.validatedAt.getTime())
  ) {
    throw new Error('Données du bilan officiel invalides')
  }

  return {
    reportId: input.reportId,
    reportVersionId: input.reportVersionId,
    version: input.version,
    reference: generateReportArchiveReference(input.validatedAt),
    associationName: input.associationName,
    projectTitle: input.projectTitle,
    reportTitle: input.reportTitle,
    intervenorName: input.intervenorName ?? null,
    sessionDate: new Date(input.sessionDate.getTime()),
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    studentsCount: input.studentsCount ?? null,
    content: input.content,
    validatedByUserId: input.validatedByUserId,
    validatedAt: new Date(input.validatedAt.getTime()),
  }
}
