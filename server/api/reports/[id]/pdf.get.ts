import { getRouterParam, setHeader } from 'h3'
import { assertProjectAccess, requirePermission } from '../../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId } from '../../../utils/api'
import { generateReportPdf } from '../../../utils/pdf'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.REPORT_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Bilan')
  const report = await prisma.projectReport.findFirst({
    where: { id, project: { associationId: context.associationId, archivedAt: null } },
    select: { projectId: true, intervenorId: true, title: true, sessionDate: true, studentsCount: true, currentVersion: true, project: { select: { title: true, association: { select: { name: true } } } }, intervenor: { select: { firstName: true, lastName: true } }, versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, content: true } } },
  })
  if (!report) httpError(404, 'Bilan introuvable.', 'REPORT_NOT_FOUND')
  await assertProjectAccess(context, report.projectId, false)
  if (context.roleCode === ROLE_CODES.INTERVENOR && report.intervenorId !== context.intervenorId) httpError(403, 'Bilan interdit.', 'REPORT_FORBIDDEN')
  const version = report.versions[0]
  if (!version) httpError(409, 'Aucune version du bilan à exporter.', 'REPORT_EMPTY')
  const pdf = await generateReportPdf({ title: report.title || 'Bilan de séance', projectTitle: report.project.title, intervenorName: report.intervenor ? `${report.intervenor.firstName} ${report.intervenor.lastName}` : null, sessionDate: report.sessionDate, studentsCount: report.studentsCount, content: version.content, version: version.version, associationName: report.project.association.name })
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="bilan-${id}.pdf"`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return Buffer.from(pdf)
})
