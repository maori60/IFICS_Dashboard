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
  const document = await prisma.intervenorAccountingDocument.findFirst({
    where: { id: documentId, intervenorId, archivedAt: null, intervenor: { associationId: context.associationId } },
    select: { id: true, type: true, intervenor: { select: { userId: true } } },
  })
  if (!document) httpError(404, 'Document introuvable.', 'DOCUMENT_NOT_FOUND')
  const updated = await prisma.intervenorAccountingDocument.update({
    where: { id: documentId },
    data: { status, adminComment, reviewedByUserId: context.userId, reviewedAt: new Date() },
    select: { id: true, status: true, adminComment: true, reviewedAt: true },
  })
  if (document.intervenor.userId) {
    await notifyUser(document.intervenor.userId, {
      type: status === 'ACCEPTED' ? 'SUCCESS' : 'WARNING',
      title: 'Document comptable examiné',
      message: `Votre ${document.type === 'INVOICE' ? 'facture' : 'devis'} a été ${status === 'ACCEPTED' ? 'validé' : 'refusé'}.`,
      href: `/intervenors/${intervenorId}`,
    })
  }
  await writeAuditLog(event, context, { action: 'INTERVENOR_ACCOUNTING_DOCUMENT_REVIEWED', entityType: 'IntervenorAccountingDocument', entityId: documentId, metadata: { intervenorId, status } })
  return success(updated)
})
