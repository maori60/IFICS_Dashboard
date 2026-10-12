export type ReportArchiveGuardState = {
  status: string
  currentVersion: number
  updatedAt: Date
  versionId: string
  versionContent: string
  title: string | null
  sessionDate: Date
  startTime: string | null
  endTime: string | null
  studentsCount: number | null
  projectTitle: string
  associationName: string
  intervenorName: string | null
}

export function reportArchiveStateMatches(
  expected: ReportArchiveGuardState,
  actual: ReportArchiveGuardState,
): boolean {
  return (
    expected.status === 'SUBMITTED'
    && actual.status === 'SUBMITTED'
    && expected.currentVersion === actual.currentVersion
    && expected.updatedAt.getTime() === actual.updatedAt.getTime()
    && expected.versionId === actual.versionId
    && expected.versionContent === actual.versionContent
    && expected.title === actual.title
    && expected.sessionDate.getTime() === actual.sessionDate.getTime()
    && expected.startTime === actual.startTime
    && expected.endTime === actual.endTime
    && expected.studentsCount === actual.studentsCount
    && expected.projectTitle === actual.projectTitle
    && expected.associationName === actual.associationName
    && expected.intervenorName === actual.intervenorName
  )
}
