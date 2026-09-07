import { requirePermission } from '../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { jsonSafe, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_READ)
  const documents = await prisma.billingDocument.findMany({
    where: {
      associationId: context.associationId,
      ...(context.roleCode === ROLE_CODES.CLIENT ? { clientId: context.clientId || '__none__' } : {}),
    },
    orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true, kind: true, number: true, status: true, issueDate: true, dueDate: true,
      currency: true, subject: true, subtotal: true, taxRate: true, taxAmount: true, total: true,
      sentAt: true, acceptedAt: true, paidAt: true,
      client: { select: { id: true, name: true } },
      project: { select: { id: true, reference: true, title: true } },
      _count: { select: { lines: true } },
    },
  })
  return success(jsonSafe(documents))
})
