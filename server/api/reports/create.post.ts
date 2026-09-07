import { readBody } from 'h3'
import { assertProjectAccess, requirePermission } from '../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, prismaErrorCode, success } from '../../utils/api'
import { optionalDate, optionalInteger, optionalString, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.REPORT_WRITE)
  const body = safeObject(await readBody(event))
  const projectId = requiredString(body.projectId, 'Projet', { max: 191 })
  await assertProjectAccess(context, projectId, false)
  const sessionDate = optionalDate(body.sessionDate, 'Date de séance')
  if (!sessionDate) httpError(400, 'Date de séance obligatoire.', 'SESSION_DATE_REQUIRED')
  const intervenorId = context.roleCode === ROLE_CODES.INTERVENOR ? context.intervenorId : optionalString(body.intervenorId, 'Intervenant', { max: 191 })
  if (context.roleCode === ROLE_CODES.INTERVENOR && !intervenorId) httpError(403, 'Profil intervenant requis.', 'INTERVENOR_PROFILE_REQUIRED')
  if (intervenorId) {
    const assignment = await prisma.projectIntervenor.findFirst({ where: { projectId, intervenorId, project: { associationId: context.associationId, archivedAt: null } }, select: { id: true } })
    if (!assignment) httpError(400, 'Intervenant non affecté à ce projet.', 'INTERVENOR_NOT_ASSIGNED')
  }

  try {
    const report = await prisma.projectReport.create({
      data: { projectId, intervenorId, title: optionalString(body.title, 'Titre', { max: 255 }) || 'Bilan de séance', sessionDate, studentsCount: optionalInteger(body.studentsCount, 'Nombre de participants', { min: 0, max: 100000 }), status: 'NOT_STARTED' },
      select: { id: true, projectId: true, intervenorId: true, title: true, sessionDate: true, studentsCount: true, status: true, currentVersion: true, createdAt: true },
    })
    await writeAuditLog(event, context, { action: 'REPORT_CREATED', entityType: 'ProjectReport', entityId: report.id, metadata: { projectId, intervenorId } })
    return success(report)
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') httpError(409, 'Un bilan existe déjà pour cette séance et cet intervenant.', 'REPORT_DUPLICATE')
    throw error
  }
})
