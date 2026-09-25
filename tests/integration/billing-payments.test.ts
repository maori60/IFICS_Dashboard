import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../server/utils/prisma'

const request = vi.hoisted(() => ({
  associationId: '',
  userId: '',
  invoiceId: '',
  paymentId: '',
  body: {} as Record<string, unknown>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    readBody: async () => request.body,
    getRouterParam: (_event: unknown, name: string) => name === 'id' ? request.invoiceId : name === 'paymentId' ? request.paymentId : undefined,
    getRequestHeader: () => undefined,
  }
})

vi.mock('../../server/utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/auth')>()
  return {
    ...actual,
    requirePermission: async () => ({
      sessionId: 'billing-payment-test',
      userId: request.userId,
      associationId: request.associationId,
      clientId: null,
      intervenorId: null,
      email: 'billing-payment@example.invalid',
      firstName: 'Test',
      lastName: 'Billing',
      roleCode: 'ADMIN',
      roleName: 'Administrateur',
      permissions: ['*'],
      mfaEnabled: true,
      mfaVerified: true,
      mfaSetupRequired: false,
    }),
    hasPermission: (context: { permissions: string[] }, permission: string) => context.permissions.includes('*') || context.permissions.includes(permission),
    getIpHash: () => null,
  }
})

describe.skipIf(process.env.BILLING_PAYMENT_INTEGRATION_TESTS !== '1')(
  'Règlements clients avec PostgreSQL',
  () => {
    const token = `${Date.now()}-${process.pid}`
    const associationId = `billing-payment-${token}`
    let userId = ''
    let clientId = ''
    let invoiceId = ''
    let postHandler: typeof import('../../server/api/billing/[id]/payments.post')['default']
    let getHandler: typeof import('../../server/api/billing/[id]/payments.get')['default']
    let reverseHandler: typeof import('../../server/api/billing/[id]/payments/[paymentId]/reverse.post')['default']
    const event = { context: { requestId: `billing-payment-${token}` } } as never

    beforeAll(async () => {
      vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
      postHandler = (await import('../../server/api/billing/[id]/payments.post')).default
      getHandler = (await import('../../server/api/billing/[id]/payments.get')).default
      reverseHandler = (await import('../../server/api/billing/[id]/payments/[paymentId]/reverse.post')).default

      const association = await prisma.association.create({ data: { id: associationId, name: 'Association paiement', timezone: 'Europe/Paris' } })
      const role = await prisma.role.create({ data: { associationId, name: `Admin ${token}`, code: `PAYMENT_${token}`, permissions: ['*'] } })
      const user = await prisma.user.create({ data: { associationId, roleId: role.id, firstName: 'Test', lastName: 'Paiement', email: `payment-${token}@example.invalid`, passwordHash: 'not-used' } })
      const client = await prisma.client.create({ data: { associationId, name: 'Client test', type: 'AUTRE', status: 'ACTIVE', addressLine1: '1 rue du Test', postalCode: '75000', city: 'Paris', country: 'France' } })
      const invoice = await prisma.billingDocument.create({ data: { associationId, clientId: client.id, createdByUserId: user.id, kind: 'INVOICE', number: `FAC-TEST-${token}`, status: 'ISSUED', issueDate: new Date(Date.UTC(2026, 8, 25)), currency: 'EUR', subtotal: '100.00', taxRate: '20.00', taxAmount: '20.00', total: '120.00' } })
      userId = user.id; clientId = client.id; invoiceId = invoice.id
      request.associationId = association.id; request.userId = user.id; request.invoiceId = invoice.id
    })

    beforeEach(() => { request.body = {} })

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { associationId } })
      await prisma.billingPayment.deleteMany({ where: { associationId } })
      await prisma.billingDocument.deleteMany({ where: { associationId } })
      await prisma.client.deleteMany({ where: { associationId } })
      await prisma.user.deleteMany({ where: { associationId } })
      await prisma.role.deleteMany({ where: { associationId } })
      await prisma.association.deleteMany({ where: { id: associationId } })
    })

    it('enregistre un règlement partiel puis solde la facture', async () => {
      request.body = { amount: '50.00', paidAt: '2026-09-25', method: 'BANK_TRANSFER', reference: 'VIR-001' }
      const first = await postHandler(event)
      expect(first.data.status).toBe('PARTIALLY_PAID')
      expect(first.data.remainingAmount).toBe('70.00')

      request.body = { amount: '70.00', paidAt: '2026-09-26', method: 'BANK_TRANSFER', reference: 'VIR-002' }
      const second = await postHandler(event)
      expect(second.data.status).toBe('PAID')
      expect(second.data.remainingAmount).toBe('0.00')

      const summary = await getHandler(event)
      expect(summary.data.payments).toHaveLength(2)
      expect(summary.data.paidAmount).toBe('120.00')
      expect(summary.data.remainingAmount).toBe('0.00')

      const updated = await prisma.billingDocument.findUniqueOrThrow({ where: { id: invoiceId } })
      expect(updated.status).toBe('PAID')
      expect(updated.paidAt).not.toBeNull()
    })


    it('annule un règlement sans supprimer sa trace et recalcule le solde', async () => {
      const another = await prisma.billingDocument.create({
        data: {
          associationId,
          clientId,
          createdByUserId: userId,
          kind: 'INVOICE',
          number: `FAC-REV-${token}`,
          status: 'SENT',
          issueDate: new Date(Date.UTC(2026, 8, 25)),
          dueDate: new Date(Date.UTC(2026, 9, 31)),
          sentAt: new Date(),
          currency: 'EUR',
          subtotal: '100.00',
          taxRate: '0.00',
          taxAmount: '0.00',
          total: '100.00',
        },
      })

      request.invoiceId = another.id
      request.body = { amount: '40.00', paidAt: '2026-09-25', method: 'BANK_TRANSFER' }
      const created = await postHandler(event)
      request.paymentId = created.data.payment.id
      request.body = { reason: 'Règlement saisi sur la mauvaise facture.' }

      const reversed = await reverseHandler(event)
      expect(reversed.data.reversed).toBe(true)
      expect(reversed.data.status).toBe('SENT')

      const summary = await getHandler(event)
      expect(summary.data.paidAmount).toBe('0.00')
      expect(summary.data.remainingAmount).toBe('100.00')
      expect(summary.data.payments[0].reversedAt).not.toBeNull()
      expect(summary.data.payments[0].reversalReason).toBe('Règlement saisi sur la mauvaise facture.')

      request.invoiceId = invoiceId
      request.paymentId = ''
    })

    it('refuse un trop-perçu', async () => {
      const another = await prisma.billingDocument.create({ data: { associationId, clientId, createdByUserId: userId, kind: 'INVOICE', number: `FAC-OVER-${token}`, status: 'ISSUED', issueDate: new Date(Date.UTC(2026, 8, 25)), currency: 'EUR', subtotal: '100.00', taxRate: '0.00', taxAmount: '0.00', total: '100.00' } })
      request.invoiceId = another.id
      request.body = { amount: '100.01', paidAt: '2026-09-25', method: 'BANK_TRANSFER' }
      await expect(postHandler(event)).rejects.toMatchObject({ statusCode: 400, data: { code: 'PAYMENT_EXCEEDS_REMAINING' } })
      request.invoiceId = invoiceId
    })
  },
)
