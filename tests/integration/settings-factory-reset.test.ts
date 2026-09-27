import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../server/utils/prisma'

const request = vi.hoisted(() => ({
  associationId: '',
  userId: '',
  mfaVerified: true,
  body: {} as Record<string, unknown>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return { ...actual, readBody: async () => request.body, getRequestHeader: () => undefined }
})

vi.mock('../../server/utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/auth')>()

  const authContext = () => ({
    sessionId: 'factory-reset-test',
    userId: request.userId,
    associationId: request.associationId,
    clientId: null,
    intervenorId: null,
    email: 'factory-reset@example.invalid',
    firstName: 'Test',
    lastName: 'Reset',
    roleCode: 'ADMIN',
    roleName: 'Administrateur',
    permissions: ['*'],
    mfaEnabled: true,
    mfaVerified: request.mfaVerified,
    mfaSetupRequired: false,
  })

  return {
    ...actual,
    requireAuth: async () => authContext(),
    requirePermission: async () => authContext(),
    hasPermission: (
      context: { permissions: string[] },
      permission: string,
    ) =>
      context.permissions.includes('*')
      || context.permissions.includes(permission),
    getIpHash: () => null,
  }
})

describe.skipIf(process.env.SETTINGS_INTEGRATION_TESTS !== '1')(
  'Restauration des paramètres usine',
  () => {
    const token = `${Date.now()}-${process.pid}`
    const associationId = `factory-reset-${token}`
    let handler: typeof import('../../server/api/settings/factory-reset.post')['default']

    beforeAll(async () => {
      vi.stubGlobal('defineEventHandler', (candidate: unknown) => candidate)
      handler = (await import('../../server/api/settings/factory-reset.post')).default
      const association = await prisma.association.create({ data: { id: associationId, name: 'IFICS Test', legalName: 'IFICS Legal', billingName: 'IFICS Facturation', billingAddress: '1 rue Test', billingPostalCode: '75000', billingCity: 'Paris', billingCountry: 'France', siret: '12345678901234', primaryColor: '#123456', secondaryColor: '#654321', pdfFooter: 'Pied de page', timezone: 'America/New_York', locale: 'en-US', currency: 'USD', maintenanceEnabled: true, maintenanceMessage: 'Maintenance' } })
      const role = await prisma.role.create({ data: { associationId, name: `Admin ${token}`, code: `RESET_${token}`, permissions: ['*'] } })
      const user = await prisma.user.create({ data: { associationId, roleId: role.id, firstName: 'Test', lastName: 'Reset', email: `reset-${token}@example.invalid`, passwordHash: 'not-used' } })
      await prisma.associationFinanceSettings.create({ data: { associationId, legalForm: 'Association', bankName: 'Banque test', bankAccountHolder: 'IFICS', iban: 'FR7612345678901234567890123', bic: 'ABCDEFGHXXX', paymentTerms: '30 jours', taxExemptionText: 'Texte fiscal', vatLiabilityStatus: 'SUBJECT', vatCollectionBasis: 'COLLECTIONS', vatFilingFrequency: 'MONTHLY', vatEffectiveFrom: new Date('2026-01-01T00:00:00.000Z'), maxAssetDocuments: 77, maxAssetDocumentMb: 33 } })
      request.associationId = association.id
      request.userId = user.id
    })

    beforeEach(() => { request.body = {}; request.mfaVerified = true })

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { associationId } })
      await prisma.associationFinanceSettings.deleteMany({ where: { associationId } })
      await prisma.user.deleteMany({ where: { associationId } })
      await prisma.role.deleteMany({ where: { associationId } })
      await prisma.association.deleteMany({ where: { id: associationId } })
    })

    it('exige le mot de confirmation', async () => {
      request.body = { confirmation: 'NON' }
      await expect(handler({ context: { requestId: 'reset-confirmation' } } as never)).rejects.toMatchObject({ statusCode: 400, data: { code: 'FACTORY_RESET_CONFIRMATION_REQUIRED' } })
    })

    it('exige une session MFA validée', async () => {
      request.mfaVerified = false
      request.body = { confirmation: 'RESTAURER' }
      await expect(handler({ context: { requestId: 'reset-mfa' } } as never)).rejects.toMatchObject({ statusCode: 403, data: { code: 'FACTORY_RESET_MFA_REQUIRED' } })
    })

    it('réinitialise la configuration sans supprimer identité et banque', async () => {
      request.body = { confirmation: 'RESTAURER' }
      const response = await handler({ context: { requestId: 'reset-success' } } as never)
      expect(response.data.restored).toBe(true)

      const association = await prisma.association.findUniqueOrThrow({ where: { id: associationId } })
      expect(association.name).toBe('IFICS Test')
      expect(association.legalName).toBe('IFICS Legal')
      expect(association.siret).toBe('12345678901234')
      expect(association.primaryColor).toBeNull()
      expect(association.timezone).toBe('Europe/Paris')
      expect(association.locale).toBe('fr-FR')
      expect(association.currency).toBe('EUR')
      expect(association.maintenanceEnabled).toBe(false)

      const finance = await prisma.associationFinanceSettings.findUniqueOrThrow({ where: { associationId } })
      expect(finance.bankName).toBe('Banque test')
      expect(finance.iban).toBe('FR7612345678901234567890123')
      expect(finance.paymentTerms).toBeNull()
      expect(finance.taxExemptionText).toBeNull()
      expect(finance.vatLiabilityStatus).toBe('SUBJECT')
      expect(finance.vatCollectionBasis).toBe('COLLECTIONS')
      expect(finance.vatFilingFrequency).toBe('MONTHLY')
      expect(
        finance.vatEffectiveFrom?.toISOString().slice(0, 10),
      ).toBe('2026-01-01')
      expect(finance.maxAssetDocuments).toBe(20)
      expect(finance.maxAssetDocumentMb).toBe(10)

      const audit
        = await prisma.auditLog.findFirst({
          where: {
            associationId,
            action:
              'ASSOCIATION_FACTORY_SETTINGS_RESTORED',
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

      expect(audit).not.toBeNull()
      expect(audit?.outcome).toBe('SUCCESS')
    })

    it(
      'annule la restauration si l’audit strict échoue',
      async () => {
        await prisma.association.update({
          where: {
            id: associationId,
          },
          data: {
            primaryColor: '#112233',
          },
        })

        await prisma.associationFinanceSettings.update({
          where: {
            associationId,
          },
          data: {
            paymentTerms:
              '45 jours test rollback',
          },
        })

        const validUserId = request.userId

        request.userId
          = `missing-user-${token}`

        request.body = {
          confirmation: 'RESTAURER',
        }

        try {
          await expect(
            handler({
              context: {
                requestId:
                  'reset-audit-rollback',
              },
            } as never),
          ).rejects.toBeDefined()
        }
        finally {
          request.userId = validUserId
        }

        const association
          = await prisma.association
            .findUniqueOrThrow({
              where: {
                id: associationId,
              },
            })

        expect(
          association.primaryColor,
        ).toBe('#112233')

        const finance
          = await prisma
            .associationFinanceSettings
            .findUniqueOrThrow({
              where: {
                associationId,
              },
            })

        expect(
          finance.paymentTerms,
        ).toBe(
          '45 jours test rollback',
        )
      },
    )
  },
)
