import { getRouterParam } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { nextBillingNumber } from '../../../utils/billing'
import { httpError, jsonSafe, requireRouterId, success } from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Devis')
  const quote = await prisma.billingDocument.findFirst({ where: { id, associationId: context.associationId, kind: 'QUOTE' }, include: { lines: { orderBy: { position: 'asc' } }, convertedInvoices: { select: { id: true } } } })
  if (!quote) httpError(404, 'Devis introuvable.', 'QUOTE_NOT_FOUND')
  if (quote.status !== 'ACCEPTED') httpError(409, 'Le devis doit être accepté avant conversion.', 'QUOTE_NOT_ACCEPTED')
  if (quote.convertedInvoices.length) httpError(409, 'Ce devis a déjà été converti.', 'QUOTE_ALREADY_CONVERTED')
  const invoice = await prisma.$transaction(async (tx) => {
    const issueDate = new Date()
    const number = await nextBillingNumber(tx, context.associationId, 'INVOICE', issueDate)
    return tx.billingDocument.create({
      data: {
        associationId: quote.associationId, clientId: quote.clientId, projectId: quote.projectId,
        createdByUserId: context.userId, sourceQuoteId: quote.id, kind: 'INVOICE', number,
        issueDate, currency: quote.currency, subject: quote.subject, notes: quote.notes,
        subtotal: quote.subtotal, taxRate: quote.taxRate, taxAmount: quote.taxAmount, total: quote.total,
        lines: { create: quote.lines.map(line => ({ position: line.position, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal })) },
      },
      include: { client: true, project: true, lines: { orderBy: { position: 'asc' } } },
    })
  })
  await writeAuditLog(event, context, { action: 'QUOTE_CONVERTED_TO_INVOICE', entityType: 'BillingDocument', entityId: invoice.id, metadata: { sourceQuoteId: quote.id, invoiceNumber: invoice.number } })
  return success(jsonSafe(invoice))
})
