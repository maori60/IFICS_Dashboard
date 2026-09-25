import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { httpError, jsonSafe, prismaErrorCode, requireRouterId, success } from '../../../utils/api'
import { prisma } from '../../../utils/prisma'
import {
  optionalDate,
  optionalString,
  requiredEnum,
  requiredMoney,
  safeObject,
} from '../../../utils/validation'
import {
  businessDateAsUtc,
  DEFAULT_BUSINESS_TIMEZONE,
} from '../../../utils/business-date'
import { assertAccountingDateWritable } from '../../../utils/accounting-periods'
import { writeAuditLog } from '../../../utils/audit'

const PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'CARD',
  'DIRECT_DEBIT',
  'CASH',
  'CHEQUE',
  'OTHER',
] as const

function moneyToCents(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) {
    httpError(400, 'Montant de règlement invalide.', 'INVALID_PAYMENT_AMOUNT')
  }

  return BigInt(match[1]!) * BigInt(100)
    + BigInt((match[2] ?? '').padEnd(2, '0'))
}

function decimalToCents(value: { toFixed(decimals: number): string }): bigint {
  return moneyToCents(value.toFixed(2))
}

function centsToMoney(value: bigint): string {
  const whole = value / BigInt(100)
  const cents = (value % BigInt(100)).toString().padStart(2, '0')
  return `${whole}.${cents}`
}

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Facture')
  const body = safeObject(await readBody(event))

  const amount = requiredMoney(body.amount, 'Montant du règlement')
  const amountCents = moneyToCents(amount)

  if (amountCents <= BigInt(0)) {
    httpError(
      400,
      'Montant du règlement doit être strictement positif.',
      'INVALID_PAYMENT_AMOUNT',
    )
  }

  const method = requiredEnum(body.method, PAYMENT_METHODS, 'Moyen de règlement')
  const reference = optionalString(body.reference, 'Référence', { max: 120 })
  const note = optionalString(body.note, 'Note', { max: 5_000 })

  const association = await prisma.association.findUnique({
    where: { id: context.associationId },
    select: { timezone: true, currency: true },
  })

  const paidAt = optionalDate(body.paidAt, 'Date du règlement')
    ?? businessDateAsUtc(
      new Date(),
      association?.timezone || DEFAULT_BUSINESS_TIMEZONE,
    )

  await assertAccountingDateWritable(
    context.associationId,
    paidAt,
    'règlement client',
  )

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.billingDocument.findFirst({
        where: {
          id,
          associationId: context.associationId,
          kind: 'INVOICE',
        },
        select: {
          id: true,
          number: true,
          total: true,
          currency: true,
          status: true,
        },
      })

      if (!invoice) {
        httpError(404, 'Facture introuvable.', 'INVOICE_NOT_FOUND')
      }

      if (!['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) {
        httpError(
          409,
          'Cette facture ne peut pas recevoir de règlement dans son état actuel.',
          'INVOICE_NOT_PAYABLE',
        )
      }

      const payments = await tx.billingPayment.findMany({
        where: {
          associationId: context.associationId,
          billingDocumentId: invoice.id,
          reversedAt: null,
        },
        select: { amount: true },
      })

      const alreadyPaidCents = payments.reduce(
        (sum, payment) => sum + decimalToCents(payment.amount),
        BigInt(0),
      )
      const totalCents = decimalToCents(invoice.total)
      const remainingBeforeCents = totalCents - alreadyPaidCents

      if (remainingBeforeCents <= BigInt(0)) {
        httpError(409, 'Cette facture est déjà soldée.', 'INVOICE_ALREADY_PAID')
      }

      if (amountCents > remainingBeforeCents) {
        httpError(
          400,
          `Le règlement dépasse le solde restant de ${centsToMoney(remainingBeforeCents)} €.`,
          'PAYMENT_EXCEEDS_REMAINING',
        )
      }

      const payment = await tx.billingPayment.create({
        data: {
          associationId: context.associationId,
          billingDocumentId: invoice.id,
          amount,
          currency: invoice.currency || association?.currency || 'EUR',
          paidAt,
          method,
          reference,
          note,
          recordedByUserId: context.userId,
        },
      })

      const paidAfterCents = alreadyPaidCents + amountCents
      const remainingAfterCents = totalCents - paidAfterCents
      const fullyPaid = remainingAfterCents === BigInt(0)

      const updated = await tx.billingDocument.update({
        where: { id: invoice.id },
        data: {
          status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: fullyPaid ? new Date() : null,
        },
        select: {
          id: true,
          status: true,
          paidAt: true,
        },
      })

      return {
        invoice,
        payment,
        updated,
        paidAfter: centsToMoney(paidAfterCents),
        remainingAfter: centsToMoney(remainingAfterCents),
      }
    }, { isolationLevel: 'Serializable' })

    await writeAuditLog(event, context, {
      action: 'BILLING_PAYMENT_RECORDED',
      entityType: 'BillingPayment',
      entityId: result.payment.id,
      metadata: {
        billingDocumentId: result.invoice.id,
        invoiceNumber: result.invoice.number,
        amount: result.payment.amount.toString(),
        currency: result.payment.currency,
        paidAt: result.payment.paidAt.toISOString(),
        method: result.payment.method,
        reference: result.payment.reference,
        resultingStatus: result.updated.status,
        remainingAmount: result.remainingAfter,
      },
    })

    return success(jsonSafe({
      payment: result.payment,
      status: result.updated.status,
      paidAmount: result.paidAfter,
      remainingAmount: result.remainingAfter,
    }))
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2034') {
      httpError(
        409,
        'Un autre règlement vient d’être enregistré. Actualisez la facture avant de recommencer.',
        'BILLING_PAYMENT_CONCURRENT_OPERATION',
      )
    }

    throw error
  }
})
