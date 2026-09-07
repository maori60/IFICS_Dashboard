import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { calculateBillingTotals } from '../../../utils/billing'
import { httpError, jsonSafe, requireRouterId, success } from '../../../utils/api'
import { optionalDate, optionalString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Document')
  const body = safeObject(await readBody(event))
  const existing = await prisma.billingDocument.findFirst({ where: { id, associationId: context.associationId }, select: { id: true, status: true, issueDate: true } })
  if (!existing) httpError(404, 'Document introuvable.', 'BILLING_NOT_FOUND')
  if (existing.status !== 'DRAFT') httpError(409, 'Seul un brouillon peut être modifié.', 'BILLING_LOCKED')
  const dueDate = body.dueDate === undefined ? undefined : optionalDate(body.dueDate, 'Échéance')
  if (dueDate && dueDate < existing.issueDate) httpError(400, 'Échéance invalide.', 'INVALID_DUE_DATE')
  const totals = calculateBillingTotals(body.lines, body.taxRate ?? 0)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.billingLine.deleteMany({ where: { billingDocumentId: id } })
    return tx.billingDocument.update({
      where: { id },
      data: {
        dueDate, subject: body.subject === undefined ? undefined : optionalString(body.subject, 'Objet', { max: 255 }),
        notes: body.notes === undefined ? undefined : optionalString(body.notes, 'Notes'),
        subtotal: totals.subtotal, taxRate: totals.taxRate, taxAmount: totals.taxAmount, total: totals.total,
        lines: { create: totals.lines },
      },
      include: { client: true, project: true, lines: { orderBy: { position: 'asc' } } },
    })
  })
  await writeAuditLog(event, context, { action: 'BILLING_DOCUMENT_UPDATED', entityType: 'BillingDocument', entityId: id, metadata: { total: updated.total.toString() } })
  return success(jsonSafe(updated))
})
