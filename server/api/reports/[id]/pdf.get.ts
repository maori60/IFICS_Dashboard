import { getRouterParam, setHeader } from 'h3'
import { assertProjectAccess, requirePermission } from '../../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId } from '../../../utils/api'
import { generateReportPdf } from '../../../utils/pdf'
import { readVerifiedOfficialReportPdf } from '../../../utils/report-archive-download'
import { writeAuditLogStrict } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.REPORT_READ)
  // Publication client désactivée jusqu'à mise en place
  // d'une autorisation explicite de partage.
  if (context.roleCode === ROLE_CODES.CLIENT) {
    httpError(404, 'Bilan introuvable.', 'REPORT_CLIENT_NOT_PUBLISHED')
  }

  const id = requireRouterId(getRouterParam(event, 'id'), 'Bilan')
  const report = await prisma.projectReport.findFirst({
    where: { id, project: { associationId: context.associationId, archivedAt: null } },
    select: { status: true, pdfPath: true, projectId: true, intervenorId: true, title: true, sessionDate: true, startTime: true, endTime: true, studentsCount: true, currentVersion: true, project: { select: { title: true, association: { select: { name: true } } } }, intervenor: { select: { firstName: true, lastName: true } }, versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, content: true } } },
  })
  if (!report) httpError(404, 'Bilan introuvable.', 'REPORT_NOT_FOUND')
  await assertProjectAccess(context, report.projectId, false)
  if (context.roleCode === ROLE_CODES.INTERVENOR && report.intervenorId !== context.intervenorId) httpError(403, 'Bilan interdit.', 'REPORT_FORBIDDEN')
  if (report.status === 'VALIDATED') {
    const archives = await prisma.projectReportArchive.findMany({
      where: {
        reportId: id,
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
        'Le document officiel de ce bilan est indisponible.',
        'REPORT_OFFICIAL_ARCHIVE_MISSING',
      )
    }

    const archive = archives[0]!

    const pdf = await readVerifiedOfficialReportPdf(archive)

    // REPORT_ACTIVE_PDF_AUDIT_STEP_232
    // Aucun PDF officiel transmis si son audit échoue.
    await writeAuditLogStrict(event, context, {
      action: 'REPORT_OFFICIAL_ARCHIVE_DOWNLOADED',
      entityType: 'ProjectReportArchive',
      entityId: archive.id,
      metadata: {
        reportId: id,
        projectId: report.projectId,
        version: archive.version,
        reference: archive.reference,
      },
    })

    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(
      event,
      'Content-Disposition',
      `inline; filename="bilan-officiel-${id}.pdf"`,
    )
    setHeader(event, 'Cache-Control', 'private, no-store')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')

    return pdf
  }

  const version = report.versions[0]
  if (!version) httpError(409, 'Aucune version du bilan à exporter.', 'REPORT_EMPTY')
  const pdf = await generateReportPdf({ title: report.title || 'Bilan de séance', projectTitle: report.project.title, intervenorName: report.intervenor ? `${report.intervenor.firstName} ${report.intervenor.lastName}` : null, sessionDate: report.sessionDate, startTime: report.startTime, endTime: report.endTime, studentsCount: report.studentsCount, content: version.content, version: version.version, associationName: report.project.association.name })
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="bilan-${id}.pdf"`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return Buffer.from(pdf)
})
