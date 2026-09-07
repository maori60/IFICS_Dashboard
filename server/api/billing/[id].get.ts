import { getRouterParam } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, jsonSafe, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Document')
  const document = await prisma.billingDocument.findFirst({
    where: { id, associationId: context.associationId, ...(context.roleCode === ROLE_CODES.CLIENT ? { clientId: context.clientId || '__none__' } : {}) },
    include: {
      association: { select: { name: true, legalName: true, billingName: true, billingAddress: true, billingPostalCode: true, billingCity: true, billingCountry: true, billingEmail: true, siret: true, pdfFooter: true } },
      client: true,
      project: { select: { id: true, reference: true, title: true } },
      lines: { orderBy: { position: 'asc' } },
      sourceQuote: { select: { id: true, number: true } },
      convertedInvoices: { select: { id: true, number: true, status: true } },
    },
  })
  if (!document) httpError(404, 'Document de facturation introuvable.', 'BILLING_NOT_FOUND')
  return success(jsonSafe(document))
})
