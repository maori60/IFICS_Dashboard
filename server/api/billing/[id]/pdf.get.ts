import { getRouterParam, setHeader } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId } from '../../../utils/api'
import { readStoredFile } from '../../../utils/files'
import { generateBillingPdf } from '../../../utils/pdf'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.BILLING_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Document')
  const document = await prisma.billingDocument.findFirst({
    where: {
      id,
      associationId: context.associationId,
      ...(context.roleCode === ROLE_CODES.CLIENT ? { clientId: context.clientId || '__none__' } : {}),
    },
    include: { association: true, client: true, lines: { orderBy: { position: 'asc' } } },
  })
  if (!document) httpError(404, 'Document introuvable.', 'BILLING_NOT_FOUND')

  const finance = await prisma.associationFinanceSettings.findUnique({
    where: { associationId: context.associationId },
  })

  let logo: { bytes: Uint8Array; mimeType: 'image/png' | 'image/jpeg' } | null = null
  if (finance?.logoFilePath) {
    try {
      const bytes = await readStoredFile(finance.logoFilePath)
      logo = {
        bytes,
        mimeType: finance.logoFilePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
      }
    }
    catch {
      logo = null
    }
  }

  const pdf = await generateBillingPdf({
    kind: document.kind,
    number: document.number,
    issueDate: document.issueDate,
    dueDate: document.dueDate,
    currency: document.currency,
    subject: document.subject,
    notes: document.notes,
    subtotal: document.subtotal,
    taxRate: document.taxRate,
    taxAmount: document.taxAmount,
    total: document.total,
    association: document.association,
    finance,
    logo,
    client: document.client,
    lines: document.lines.map(line => ({
      position: line.position,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
  })

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="${document.number}.pdf"`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return Buffer.from(pdf)
})