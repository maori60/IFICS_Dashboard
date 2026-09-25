import { getRouterParam } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../../utils/constants'
import { httpError, jsonSafe, requireRouterId, success } from '../../../utils/api'
import { prisma } from '../../../utils/prisma'

function cents(value: { toFixed(decimals: number): string }): bigint {
  const [whole, fraction = ''] = value.toFixed(2).split('.')
  return BigInt(whole!) * BigInt(100) + BigInt(fraction.padEnd(2, '0'))
}

function money(value: bigint): string {
  return `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Facture')

  const invoice = await prisma.billingDocument.findFirst({
    where: {
      id,
      associationId: context.associationId,
      kind: 'INVOICE',
      ...(context.roleCode === ROLE_CODES.CLIENT
        ? { clientId: context.clientId || '__none__' }
        : {}),
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

  const payments = await prisma.billingPayment.findMany({
    where: {
      associationId: context.associationId,
      billingDocumentId: invoice.id,
    },
    orderBy: [
      { paidAt: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  const paidCents = payments.reduce(
    (sum, payment) => payment.reversedAt ? sum : sum + cents(payment.amount),
    BigInt(0),
  )
  const totalCents = cents(invoice.total)
  const remainingCents = totalCents > paidCents ? totalCents - paidCents : BigInt(0)

  return success(jsonSafe({
    invoice,
    paidAmount: money(paidCents),
    remainingAmount: money(remainingCents),
    payments,
  }))
})
