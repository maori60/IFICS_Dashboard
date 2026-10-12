import type { Prisma } from '../../generated/prisma/client'
import { prisma } from './prisma'

export const reportArchiveSelect = {
  id: true,
  projectId: true,
  title: true,
  status: true,
  currentVersion: true,
  updatedAt: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  studentsCount: true,
  project: {
    select: {
      title: true,
      association: {
        select: {
          name: true,
        },
      },
    },
  },
  intervenor: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  versions: {
    orderBy: {
      version: 'desc',
    },
    take: 1,
    select: {
      id: true,
      version: true,
      content: true,
    },
  },
} satisfies Prisma.ProjectReportSelect

export type ReportArchiveSource = Prisma.ProjectReportGetPayload<{
  select: typeof reportArchiveSelect
}>

type ReportArchiveDbClient = Pick<
  Prisma.TransactionClient,
  'projectReport' | 'project' | 'intervenor' | 'projectReportVersion'
>

export async function findReportArchiveSource(
  reportId: string,
  associationId: string,
  db: ReportArchiveDbClient = prisma,
): Promise<ReportArchiveSource | null> {
  const report = await db.projectReport.findFirst({
    where: {
      id: reportId,
      status: 'SUBMITTED',
      project: {
        associationId,
        archivedAt: null,
      },
    },
    select: {
      id: true,
      projectId: true,
      intervenorId: true,
      title: true,
      status: true,
      currentVersion: true,
      updatedAt: true,
      sessionDate: true,
      startTime: true,
      endTime: true,
      studentsCount: true,
    },
  })

  if (!report) {
    return null
  }

  const project = await db.project.findFirst({
    where: {
      id: report.projectId,
      associationId,
      archivedAt: null,
    },
    select: {
      title: true,
      association: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!project) {
    return null
  }

  const intervenor = report.intervenorId
    ? await db.intervenor.findUnique({
        where: {
          id: report.intervenorId,
        },
        select: {
          firstName: true,
          lastName: true,
        },
      })
    : null

  const versions = await db.projectReportVersion.findMany({
    where: {
      reportId: report.id,
    },
    orderBy: {
      version: 'desc',
    },
    take: 1,
    select: {
      id: true,
      version: true,
      content: true,
    },
  })

  return {
    id: report.id,
    projectId: report.projectId,
    title: report.title,
    status: report.status,
    currentVersion: report.currentVersion,
    updatedAt: report.updatedAt,
    sessionDate: report.sessionDate,
    startTime: report.startTime,
    endTime: report.endTime,
    studentsCount: report.studentsCount,
    project,
    intervenor,
    versions,
  }
}