import { getRouterParam, readBody } from 'h3'
import { assertProjectAccess, hasPermission, requirePermission } from '../../../utils/auth'
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
  const report = await prisma.projectReport.findFirst({ where: { id, project: { associationId: context.associationId, archivedAt: null } }, select: { id: true, projectId: true, intervenorId: true, currentVersion: true, status: true, revisionByIfics: true } })
  if (!report) httpError(404, 'Bilan introuvable.', 'REPORT_NOT_FOUND')
  await assertProjectAccess(context, report.projectId, false)
  if (context.roleCode === ROLE_CODES.INTERVENOR && report.intervenorId !== context.intervenorId) httpError(403, 'Modification interdite.', 'REPORT_FORBIDDEN')
  const canReview = context.roleCode !== ROLE_CODES.INTERVENOR
    && context.roleCode !== ROLE_CODES.CLIENT
    && hasPermission(context, PERMISSIONS.REPORT_REVIEW)

  const administrativeRevision = report.status === 'SUBMITTED' && canReview

  if (report.revisionByIfics && !canReview) {
    httpError(403, 'Révision réservée à IFICS.', 'REPORT_IFICS_REVISION_LOCKED')
  }

  if (report.status === 'VALIDATED'
    || (report.status === 'SUBMITTED' && !administrativeRevision)) {
    httpError(409, 'Ce bilan est verrouillé.', 'REPORT_LOCKED')
  }

  const nextVersion = report.currentVersion + 1
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.projectReport.updateMany({
      where: {
        id,
        currentVersion: report.currentVersion,
        revisionByIfics: report.revisionByIfics,
        status: {
          in: administrativeRevision
            ? ['SUBMITTED']
            : ['NOT_STARTED', 'IN_PROGRESS', 'REFUSED'],
        },
      },
      data: {
        currentVersion: { increment: 1 },
        status: 'IN_PROGRESS',
        revisionByIfics: administrativeRevision || report.revisionByIfics,
        submittedAt: administrativeRevision ? null : undefined,
        reviewedAt: administrativeRevision ? null : undefined,
        reviewedByUserId: administrativeRevision ? null : undefined,
        validatedAt: administrativeRevision ? null : undefined,
        refusalReason: administrativeRevision ? null : undefined,
        title: optionalString(body.title, 'Titre', { max: 255 }) || undefined,
        studentsCount: body.studentsCount === undefined
          ? undefined
          : optionalInteger(body.studentsCount, 'Nombre de participants', { min: 0, max: 100000 }),
        comment: body.comment === undefined
          ? undefined
          : optionalString(body.comment, 'Commentaire'),
      },
    })

    if (updated.count !== 1) {
      httpError(409, 'Le bilan a été modifié ou transmis entre-temps. Actualisez la page.', 'REPORT_CONFLICT')
    }

    await tx.projectReportVersion.create({
      data: {
        reportId: id,
        createdByUserId: context.userId,
        version: nextVersion,
        content,
      },
    })

    return tx.projectReport.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true, currentVersion: true, updatedAt: true },
    })
  })
  await writeAuditLog(event, context, { action: 'REPORT_VERSION_SAVED', entityType: 'ProjectReport', entityId: id, metadata: {
    version: nextVersion,
    administrativeRevision,
    previousStatus: report.status,
  } })
  return success(result)
})
