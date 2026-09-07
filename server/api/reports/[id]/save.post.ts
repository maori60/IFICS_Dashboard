import { getRouterParam, readBody } from 'h3'
import { assertProjectAccess, requirePermission } from '../../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { optionalInteger, optionalString, requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.REPORT_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Bilan')
  const body = safeObject(await readBody(event))
  const content = requiredString(body.content, 'Contenu', { max: 100000 })
  const report = await prisma.projectReport.findFirst({ where: { id, project: { associationId: context.associationId, archivedAt: null } }, select: { id: true, projectId: true, intervenorId: true, currentVersion: true, status: true } })
  if (!report) httpError(404, 'Bilan introuvable.', 'REPORT_NOT_FOUND')
  await assertProjectAccess(context, report.projectId, false)
  if (context.roleCode === ROLE_CODES.INTERVENOR && report.intervenorId !== context.intervenorId) httpError(403, 'Modification interdite.', 'REPORT_FORBIDDEN')
  if (report.status === 'VALIDATED') httpError(409, 'Un bilan validé ne peut plus être modifié.', 'REPORT_LOCKED')

  const nextVersion = report.currentVersion + 1
  const result = await prisma.$transaction(async (tx) => {
    await tx.projectReportVersion.create({ data: { reportId: id, createdByUserId: context.userId, version: nextVersion, content } })
    return tx.projectReport.update({ where: { id }, data: { currentVersion: nextVersion, status: 'IN_PROGRESS', title: optionalString(body.title, 'Titre', { max: 255 }) || undefined, studentsCount: body.studentsCount === undefined ? undefined : optionalInteger(body.studentsCount, 'Nombre de participants', { min: 0, max: 100000 }), comment: body.comment === undefined ? undefined : optionalString(body.comment, 'Commentaire') }, select: { id: true, status: true, currentVersion: true, updatedAt: true } })
  })
  await writeAuditLog(event, context, { action: 'REPORT_VERSION_SAVED', entityType: 'ProjectReport', entityId: id, metadata: { version: nextVersion } })
  return success(result)
})
