import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../../../utils/auth'
import { PERMISSIONS } from '../../../../../utils/constants'
import { httpError, prismaErrorCode, requireRouterId, success } from '../../../../../utils/api'
import { prisma } from '../../../../../utils/prisma'
import { requiredString, safeObject } from '../../../../../utils/validation'
import { assertAccountingDateWritable } from '../../../../../utils/accounting-periods'
import { businessDateAsUtc, DEFAULT_BUSINESS_TIMEZONE } from '../../../../../utils/business-date'
import { writeAuditLog } from '../../../../../utils/audit'

function cents(value: { toFixed(decimals: number): string }): bigint {
  const [whole, fraction = ''] = value.toFixed(2).split('.')
  return BigInt(whole!) * BigInt(100) + BigInt(fraction.padEnd(2, '0'))
}

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_WRITE)
  const invoiceId = requireRouterId(getRouterParam(event, 'id'), 'Facture')
  const paymentId = requireRouterId(getRouterParam(event, 'paymentId'), 'Règlement')
  const body = safeObject(await readBody(event))
  const reason = requiredString(body.reason, 'Motif d’annulation du règlement', { max: 2_000 })

  const payment = await prisma.billingPayment.findFirst({
    where: {
      id: paymentId,
      billingDocumentId: invoiceId,
      associationId: context.associationId,
    },
    select: {
      id: true,
      paidAt: true,
      reversedAt: true,
    },
  })

  if (!payment) {
    httpError(404, 'Règlement introuvable.', 'BILLING_PAYMENT_NOT_FOUND')
  }

  if (payment.reversedAt) {
    httpError(409, 'Ce règlement est déjà annulé.', 'BILLING_PAYMENT_ALREADY_REVERSED')
  }

  await assertAccountingDateWritable(
    context.associationId,
    payment.paidAt,
    'annulation du règlement client',
  )

  try {
    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.billingPayment.updateMany({
        where: {
          id: paymentId,
          billingDocumentId: invoiceId,
          associationId: context.associationId,
          reversedAt: null,
        },
        data: {
          reversedAt: new Date(),
          reversedByUserId: context.userId,
          reversalReason: reason,
        },
      })

      if (changed.count !== 1) {
        httpError(409, 'Ce règlement vient déjà d’être modifié.', 'BILLING_PAYMENT_VERSION_CONFLICT')
      }

      const invoice = await tx.billingDocument.findFirst({
        where: {
          id: invoiceId,
          associationId: context.associationId,
          kind: 'INVOICE',
        },
        select: {
          id: true,
          number: true,
          total: true,
          status: true,
          dueDate: true,
          sentAt: true,
          association: {
            select: { timezone: true },
          },
        },
      })

      if (!invoice) {
        httpError(404, 'Facture introuvable.', 'INVOICE_NOT_FOUND')
      }

      const activePayments = await tx.billingPayment.findMany({
        where: {
          billingDocumentId: invoice.id,
          associationId: context.associationId,
          reversedAt: null,
        },
        select: { amount: true },
      })

      const paidCents = activePayments.reduce(
        (sum, item) => sum + cents(item.amount),
        BigInt(0),
      )
      const totalCents = cents(invoice.total)

      const currentBusinessDate = businessDateAsUtc(
        new Date(),
        invoice.association.timezone || DEFAULT_BUSINESS_TIMEZONE,
      )

      const unpaidStatus = invoice.dueDate && invoice.dueDate < currentBusinessDate
        ? 'OVERDUE'
        : invoice.sentAt
          ? 'SENT'
          : 'ISSUED'

      const nextStatus = paidCents === BigInt(0)
        ? unpaidStatus
        : paidCents >= totalCents
          ? 'PAID'
          : 'PARTIALLY_PAID'

      const updated = await tx.billingDocument.update({
        where: { id: invoice.id },
        data: {
          status: nextStatus,
          paidAt: nextStatus === 'PAID' ? invoice.status === 'PAID' ? undefined : new Date() : null,
        },
        select: { id: true, status: true, paidAt: true },
      })

      return { invoice, updated, paidCents, totalCents }
    }, { isolationLevel: 'Serializable' })

    await writeAuditLog(event, context, {
      action: 'BILLING_PAYMENT_REVERSED',
      entityType: 'BillingPayment',
      entityId: paymentId,
      metadata: {
        billingDocumentId: invoiceId,
        invoiceNumber: result.invoice.number,
        reason,
        resultingStatus: result.updated.status,
      },
    })

    return success({
      reversed: true,
      status: result.updated.status,
    })
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2034') {
      httpError(
        409,
        'Une opération concurrente a été détectée sur cette facture. Actualisez puis recommencez.',
        'BILLING_PAYMENT_CONCURRENT_OPERATION',
      )
    }

    throw error
  }
})
