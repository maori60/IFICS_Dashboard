import { getRouterParam, setHeader } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { httpError, requireRouterId } from '../../../../utils/api'
import { assertOfficialArchiveReadAccess } from '../../../../utils/report-archive-access'
import { readVerifiedOfficialReportPdf } from '../../../../utils/report-archive-download'
import { writeAuditLogStrict } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(
    event,
    PERMISSIONS.REPORT_ARCHIVE_READ,
  )

  const id = requireRouterId(
    getRouterParam(event, 'id'),
    'Bilan',
  )

  const report = await prisma.projectReport.findFirst({
    where: {
      id,
      project: {
        associationId: context.associationId,
        archivedAt: { not: null },
      },
    },
    select: {
      id: true,
      status: true,
      currentVersion: true,
      pdfPath: true,
      project: {
        select: {
          id: true,
          associationId: true,
          classification: true,
        },
      },
    },
  })

  if (!report) {
    httpError(
      404,
      'Archive introuvable.',
      'REPORT_ARCHIVE_NOT_FOUND',
    )
  }

  assertOfficialArchiveReadAccess(
    context,
    report.project,
  )

  if (report.status !== 'VALIDATED') {
    httpError(
      404,
      'Aucun document officiel disponible.',
      'REPORT_ARCHIVE_NOT_FOUND',
    )
  }

  const archives = await prisma.projectReportArchive.findMany({
    where: {
      reportId: report.id,
      version: report.currentVersion,
    },
    take: 2,
  })

  if (
    archives.length !== 1
    || !report.pdfPath
    || archives[0]!.filePath !== report.pdfPath
  ) {
    httpError(
      409,
      'Le document officiel est indisponible.',
      'REPORT_OFFICIAL_ARCHIVE_MISSING',
    )
  }

  const archive = archives[0]!
  const pdf = await readVerifiedOfficialReportPdf(archive)

  await writeAuditLogStrict(event, context, {
    action: 'REPORT_OFFICIAL_ARCHIVE_DOWNLOADED',
    entityType: 'ProjectReportArchive',
    entityId: archive.id,
    metadata: {
      reportId: report.id,
      projectId: report.project.id,
      version: archive.version,
      reference: archive.reference,
    },
  })

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="bilan-officiel-${report.id}.pdf"`,
  )
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  return pdf
})
