import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { calculateBillingTotals, nextBillingNumber } from '../../utils/billing'
import { httpError, jsonSafe, success } from '../../utils/api'
import { optionalDate, optionalString, requiredEnum, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

const KINDS = ['QUOTE', 'INVOICE'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_WRITE)
  const body = safeObject(await readBody(event))
  const kind = requiredEnum(body.kind, KINDS, 'Type de document')
  const clientId = requiredString(body.clientId, 'Client', { max: 191 })
  const projectId = optionalString(body.projectId, 'Projet', { max: 191 })
  const issueDate = optionalDate(body.issueDate, 'Date d’émission') || new Date()
  const dueDate = optionalDate(body.dueDate, 'Date d’échéance')
  if (dueDate && dueDate < issueDate) httpError(400, 'L’échéance ne peut pas précéder la date d’émission.', 'INVALID_DUE_DATE')

  const client = await prisma.client.findFirst({ where: { id: clientId, associationId: context.associationId, archivedAt: null }, select: { id: true } })
  if (!client) httpError(404, 'Client introuvable.', 'CLIENT_NOT_FOUND')
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, associationId: context.associationId, archivedAt: null, projectClients: { some: { clientId } } }, select: { id: true } })
    if (!project) httpError(400, 'Le projet ne correspond pas à ce client.', 'PROJECT_CLIENT_MISMATCH')
  }

  const totals = calculateBillingTotals(body.lines, body.taxRate ?? 0)
  const document = await prisma.$transaction(async (tx) => {
    const number = await nextBillingNumber(tx, context.associationId, kind, issueDate)
    return tx.billingDocument.create({
      data: {
        associationId: context.associationId, clientId, projectId, createdByUserId: context.userId,
        kind, number, issueDate, dueDate, currency: 'EUR',
        subject: optionalString(body.subject, 'Objet', { max: 255 }), notes: optionalString(body.notes, 'Notes'),
        subtotal: totals.subtotal, taxRate: totals.taxRate, taxAmount: totals.taxAmount, total: totals.total,
        lines: { create: totals.lines },
      },
      include: { client: true, project: true, lines: { orderBy: { position: 'asc' } } },
    })
  })
  await writeAuditLog(event, context, { action: 'BILLING_DOCUMENT_CREATED', entityType: 'BillingDocument', entityId: document.id, metadata: { kind, number: document.number, clientId, projectId, total: document.total.toString() } })
  return success(jsonSafe(document))
})
