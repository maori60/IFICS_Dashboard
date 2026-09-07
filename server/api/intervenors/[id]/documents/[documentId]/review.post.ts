import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../../../utils/auth'
import { PERMISSIONS } from '../../../../../utils/constants'
import { prisma } from '../../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../../utils/api'
import { optionalString, requiredEnum, safeObject } from '../../../../../utils/validation'
import { writeAuditLog } from '../../../../../utils/audit'
import { notifyUser } from '../../../../../utils/notifications'

const STATUSES = ['ACCEPTED', 'REFUSED'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.DOCUMENT_REVIEW)
  const intervenorId = requireRouterId(getRouterParam(event, 'id'), 'Intervenant')
  const documentId = requireRouterId(getRouterParam(event, 'documentId'), 'Document')
  const body = safeObject(await readBody(event))
  const status = requiredEnum(body.status, STATUSES, 'Décision')
  const adminComment = optionalString(body.adminComment, 'Commentaire')

  const document = await prisma.intervenorDocument.findFirst({
    where: { id: documentId, intervenorId, archivedAt: null, intervenor: { associationId: context.associationId } },
    select: { id: true, type: true, expiresAt: true, intervenor: { select: { userId: true } } },
  })
  if (!document) httpError(404, 'Document introuvable.', 'DOCUMENT_NOT_FOUND')

  const now = new Date()
  const effectiveStatus = status === 'ACCEPTED' && document.expiresAt && document.expiresAt <= now ? 'EXPIRED' : status
  const updated = await prisma.intervenorDocument.update({
    where: { id: documentId },
    data: { status: effectiveStatus, adminComment, reviewedByUserId: context.userId, reviewedAt: now },
    select: { id: true, type: true, status: true, adminComment: true, issuedAt: true, expiresAt: true, reviewedAt: true },
  })

  if (document.intervenor.userId) {
    await notifyUser(document.intervenor.userId, {
      type: effectiveStatus === 'ACCEPTED' ? 'SUCCESS' : 'WARNING',
      title: 'Document administratif examiné',
      message: effectiveStatus === 'ACCEPTED'
        ? `Votre document ${document.type} a été validé.`
        : effectiveStatus === 'EXPIRED'
          ? `Votre document ${document.type} est déjà expiré et doit être renouvelé.`
          : `Votre document ${document.type} a été refusé.`,
      href: `/dashboard/intervenors`,
    })
  }

  await writeAuditLog(event, context, {
    action: 'INTERVENOR_DOCUMENT_REVIEWED', entityType: 'IntervenorDocument', entityId: documentId,
    metadata: { intervenorId, status: effectiveStatus },
  })
  return success(updated)
})
