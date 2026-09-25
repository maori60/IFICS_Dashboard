import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { requiredEnum, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'
import { notifyClientUsers } from '../../../utils/notifications'
import { assertAccountingDateWritable } from '../../../utils/accounting-periods'

const STATUSES = ['DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const
const QUOTE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'], ISSUED: ['SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'], SENT: ['ACCEPTED', 'REJECTED', 'CANCELLED'], ACCEPTED: ['CANCELLED'], REJECTED: ['CANCELLED'], CANCELLED: [],
}
const INVOICE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'], ISSUED: ['SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'], SENT: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'], PARTIALLY_PAID: ['PAID', 'OVERDUE'], OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'], PAID: [], CANCELLED: [],
}

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Document')
  const body = safeObject(await readBody(event))
  const status = requiredEnum(body.status, STATUSES, 'Statut')

  if (status === 'PARTIALLY_PAID' || status === 'PAID') {
    httpError(
      409,
      'Enregistrez le règlement depuis la section Paiements de la facture.',
      'BILLING_PAYMENT_REQUIRED',
    )
  }
  const document = await prisma.billingDocument.findFirst({ where: { id, associationId: context.associationId }, select: { id: true, kind: true, number: true, status: true, clientId: true, issueDate: true } })
  if (!document) httpError(404, 'Document introuvable.', 'BILLING_NOT_FOUND')
  const transitions = document.kind === 'QUOTE' ? QUOTE_TRANSITIONS : INVOICE_TRANSITIONS
  if (!(transitions[document.status] || []).includes(status)) httpError(409, `Transition ${document.status} → ${status} interdite.`, 'INVALID_BILLING_TRANSITION')

  /*
   * Une clôture bloque les changements qui modifient
   * la substance comptable de la facture.
   *
   * Elle ne bloque volontairement pas :
   * - SENT ;
   * - OVERDUE ;
   * - PARTIALLY_PAID ;
   * - PAID.
   *
   * Ces états peuvent évoluer après la clôture du mois
   * d'émission sans modifier les montants de la facture.
   */
  const changesAccountingMeaning
    = document.kind === 'INVOICE'
      && (
        (
          document.status === 'DRAFT'
          && status === 'ISSUED'
        )
        || (
          status === 'CANCELLED'
          && document.status !== 'DRAFT'
        )
      )

  if (changesAccountingMeaning) {
    await assertAccountingDateWritable(
      context.associationId,
      document.issueDate,
      'facture',
    )
  }

  const now = new Date()
  const updated = await prisma.billingDocument.update({
    where: { id },
    data: {
      status,
      sentAt:
        status === 'SENT'
          ? now
          : undefined,

      acceptedAt:
        status === 'ACCEPTED'
          ? now
          : undefined,
    },
    select: { id: true, kind: true, number: true, status: true, sentAt: true, acceptedAt: true, paidAt: true },
  })
  if (status === 'SENT') {
    await notifyClientUsers(document.clientId, { type: 'ACTION', title: `${document.kind === 'QUOTE' ? 'Devis' : 'Facture'} ${document.number}`, message: 'Un nouveau document de facturation est disponible dans votre espace.', href: `/billing/${id}`, email: true })
  }
  await writeAuditLog(event, context, { action: 'BILLING_STATUS_CHANGED', entityType: 'BillingDocument', entityId: id, metadata: { from: document.status, to: status } })
  return success(updated)
})
