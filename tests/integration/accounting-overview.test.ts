import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { prisma } from '../../server/utils/prisma'

let overviewHandler:
  typeof import(
    '../../server/api/accounting/overview.get'
  )['default']

const request = vi.hoisted(() => ({
  associationId: '',
  userId: '',
  permissions: [
    'accounting:read',
  ] as string[],
  query: {} as Record<string, unknown>,
}))

vi.mock(
  'h3',
  async (importOriginal) => {
    const actual
      = await importOriginal<typeof import('h3')>()

    return {
      ...actual,

      getQuery:
        () => request.query,
    }
  },
)

vi.mock(
  '../../server/utils/auth',
  async (importOriginal) => {
    const actual
      = await importOriginal<
        typeof import('../../server/utils/auth')
      >()

    return {
      ...actual,

      requirePermission:
        async (
          _event: unknown,
          permission: string,
        ) => {
          if (
            !request.permissions.includes('*')
            && !request.permissions.includes(
              permission,
            )
          ) {
            const error
              = new Error(
                'Permission insuffisante.',
              ) as Error & {
                statusCode: number
                data: {
                  code: string
                }
              }

            error.statusCode = 403
            error.data = {
              code: 'FORBIDDEN',
            }

            throw error
          }

          return {
            sessionId:
              'accounting-overview-test',

            userId:
              request.userId,

            associationId:
              request.associationId,

            clientId: null,
            intervenorId: null,
            roleCode: 'ADMIN',

            permissions:
              request.permissions,

            mfaVerified: true,
            mfaSetupRequired: false,
          }
        },
    }
  },
)

const token
  = `${Date.now()}-${process.pid}`

const associationId
  = `accounting-overview-${token}`

const foreignAssociationId
  = `accounting-overview-foreign-${token}`

let userId = ''
let clientId = ''

const event = {
  context: {
    requestId:
      `accounting-overview-${token}`,
  },
} as never

describe.skipIf(
  process.env
    .ACCOUNTING_INTEGRATION_TESTS !== '1',
)(
  'Vue comptable',
  () => {
    beforeAll(async () => {
      vi.stubGlobal(
        'defineEventHandler',
        (handler: unknown) => handler,
      )

      overviewHandler = (
        await import(
          '../../server/api/accounting/overview.get'
        )
      ).default

      await prisma.association.createMany({
        data: [
          {
            id: associationId,
            name:
              'Association overview test',
            timezone:
              'Europe/Paris',
          },
          {
            id: foreignAssociationId,
            name:
              'Association overview étrangère',
            timezone:
              'Europe/Paris',
          },
        ],
      })

      const role
        = await prisma.role.create({
          data: {
            associationId,
            name:
              `Comptabilité ${token}`,
            code:
              `OVERVIEW_${token}`,
            permissions: [
              'accounting:read',
            ],
          },
        })

      const user
        = await prisma.user.create({
          data: {
            associationId,
            roleId: role.id,
            firstName: 'Test',
            lastName: 'Overview',
            email:
              `overview-${token}@example.invalid`,
            passwordHash:
              'integration-test-not-used',
          },
        })

      userId = user.id

      const client
        = await prisma.client.create({
          data: {
            associationId,
            name:
              'Client overview test',
            type: 'AUTRE',
            status: 'ACTIVE',
            addressLine1:
              '1 rue du Test',
            postalCode: '75000',
            city: 'Paris',
            country: 'France',
          },
        })

      clientId = client.id

      request.associationId =
        associationId

      request.userId =
        userId

      /*
       * Facture incluse :
       * exactement le dernier jour demandé.
       */
      const includedInvoice
        = await prisma.billingDocument.create({
          data: {
            associationId,
            clientId,
            createdByUserId: userId,
            kind: 'INVOICE',
            number:
              `FAC-IN-${token}`,
            status: 'ISSUED',
            issueDate:
              new Date(
                '2026-09-30T00:00:00.000Z',
              ),
            currency: 'EUR',
            subtotal: '100.00',
            taxRate: '20.00',
            taxAmount: '20.00',
            total: '120.00',
          },
        })

      /*
       * Facture du lendemain :
       * elle ne doit jamais entrer
       * dans septembre.
       */
      await prisma.billingDocument.create({
        data: {
          associationId,
          clientId,
          createdByUserId: userId,
          kind: 'INVOICE',
          number:
            `FAC-OUT-${token}`,
          status: 'ISSUED',
          issueDate:
            new Date(
              '2026-10-01T00:00:00.000Z',
            ),
          currency: 'EUR',
          subtotal: '900.00',
          taxRate: '20.00',
          taxAmount: '180.00',
          total: '1080.00',
        },
      })

      await prisma.billingPayment.create({
        data: {
          associationId,
          billingDocumentId:
            includedInvoice.id,
          amount: '120.00',
          currency: 'EUR',
          paidAt:
            new Date(
              '2026-09-30T00:00:00.000Z',
            ),
          method:
            'BANK_TRANSFER',
          recordedByUserId:
            userId,
        },
      })

      /*
       * Même type de donnée dans une autre
       * association : elle doit rester invisible.
       */
      const foreignClient
        = await prisma.client.create({
          data: {
            associationId:
              foreignAssociationId,
            name:
              'Client étranger overview',
            type: 'AUTRE',
            status: 'ACTIVE',
            addressLine1:
              '2 rue du Test',
            postalCode: '75000',
            city: 'Paris',
            country: 'France',
          },
        })

      await prisma.billingDocument.create({
        data: {
          associationId:
            foreignAssociationId,
          clientId:
            foreignClient.id,
          kind: 'INVOICE',
          number:
            `FAC-FOREIGN-${token}`,
          status: 'ISSUED',
          issueDate:
            new Date(
              '2026-09-30T00:00:00.000Z',
            ),
          currency: 'EUR',
          subtotal: '5000.00',
          taxRate: '20.00',
          taxAmount: '1000.00',
          total: '6000.00',
        },
      })
    })

    beforeEach(() => {
      request.query = {
        from: '2026-09-01',
        to: '2026-09-30',
      }

      request.permissions = [
        'accounting:read',
      ]

      request.associationId =
        associationId
    })

    afterAll(async () => {
      await prisma.billingPayment.deleteMany({
        where: {
          associationId: {
            in: [
              associationId,
              foreignAssociationId,
            ],
          },
        },
      })

      await prisma.billingDocument.deleteMany({
        where: {
          associationId: {
            in: [
              associationId,
              foreignAssociationId,
            ],
          },
        },
      })

      await prisma.client.deleteMany({
        where: {
          associationId: {
            in: [
              associationId,
              foreignAssociationId,
            ],
          },
        },
      })

      await prisma.user.deleteMany({
        where: {
          associationId,
        },
      })

      await prisma.role.deleteMany({
        where: {
          associationId,
        },
      })

      await prisma.association.deleteMany({
        where: {
          id: {
            in: [
              associationId,
              foreignAssociationId,
            ],
          },
        },
      })
    })

    it(
      'inclut le dernier jour et exclut le lendemain',
      async () => {
        const result =
          await overviewHandler(event)

        expect(
          result.data.period,
        ).toEqual({
          from: '2026-09-01',
          to: '2026-09-30',
        })

        expect(
          result.data.billing.invoiceCount,
        ).toBe(1)

        expect(
          result.data.billing.exclTax,
        ).toBe('100.00')

        expect(
          result.data.billing.tax,
        ).toBe('20.00')

        expect(
          result.data.billing.inclTax,
        ).toBe('120.00')

        expect(
          result.data.billing.collected,
        ).toBe('120.00')

        expect(
          result.data.tax.collectedTax,
        ).toBe('20.00')
      },
    )

    it(
      'refuse une date civile impossible',
      async () => {
        request.query = {
          from: '2026-02-30',
          to: '2026-09-30',
        }

        await expect(
          overviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 400,
          data: {
            code:
              'ACCOUNTING_OVERVIEW_INVALID_FROM',
          },
        })
      },
    )

    it(
      'refuse un horodatage à la place d’une date métier',
      async () => {
        request.query = {
          from:
            '2026-09-01T12:00:00Z',
          to: '2026-09-30',
        }

        await expect(
          overviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 400,
          data: {
            code:
              'ACCOUNTING_OVERVIEW_INVALID_FROM',
          },
        })
      },
    )

    it(
      'refuse une période inversée',
      async () => {
        request.query = {
          from: '2026-10-01',
          to: '2026-09-30',
        }

        await expect(
          overviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 400,
          data: {
            code:
              'ACCOUNTING_OVERVIEW_INVALID_RANGE',
          },
        })
      },
    )

    it(
      'isole strictement les données par association',
      async () => {
        const result =
          await overviewHandler(event)

        expect(
          result.data.billing.invoiceCount,
        ).toBe(1)

        expect(
          result.data.billing.inclTax,
        ).toBe('120.00')
      },
    )

    it(
      'exige la permission de lecture comptable',
      async () => {
        request.permissions = []

        await expect(
          overviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
          data: {
            code: 'FORBIDDEN',
          },
        })
      },
    )
  },
)
