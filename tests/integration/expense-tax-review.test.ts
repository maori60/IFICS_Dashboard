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

let taxReviewHandler:
  typeof import(
    '../../server/api/expenses/[id]/tax-review.post'
  )['default']

const request = vi.hoisted(() => ({
  associationId: '',
  userId: '',
  expenseId: '',
  permissions: [] as string[],
  body: {} as Record<string, unknown>,
}))

vi.mock(
  'h3',
  async (importOriginal) => {
    const actual
      = await importOriginal<typeof import('h3')>()

    return {
      ...actual,

      readBody:
        async () => request.body,

      getRouterParam:
        (
          _event: unknown,
          name: string,
        ) =>
          name === 'id'
            ? request.expenseId
            : undefined,

      getRequestHeader:
        () => undefined,
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

      requireAuth:
        async () => ({
          sessionId:
            'expense-tax-review-test',

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
        }),

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
            const error =
              new Error(
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
              'expense-tax-review-test',

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

      hasPermission:
        (
          context: {
            permissions?: string[]
          },
          permission: string,
        ) =>
          Boolean(
            context.permissions?.includes('*')
            || context.permissions?.includes(
              permission,
            ),
          ),
    }
  },
)

const event = {
  context: {
    requestId:
      'expense-tax-review-integration',
  },

  node: {
    req: {
      headers: {},
      socket: {
        remoteAddress:
          '127.0.0.1',
      },
    },
  },
} as unknown as import('h3').H3Event

const token
  = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`

const associationId
  = `tax-review-association-${token}`

const foreignAssociationId
  = `tax-review-foreign-${token}`

let userId = ''
let foreignExpenseId = ''

async function createExpense(
  options: {
    status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID'
    expenseDate?: Date
    taxAmount?: string
    associationId?: string
  } = {},
) {
  return prisma.expense.create({
    data: {
      associationId:
        options.associationId
        ?? associationId,

      createdByUserId:
        options.associationId
          === foreignAssociationId
          ? undefined
          : userId,

      category: 'SOFTWARE',

      status:
        options.status
        ?? 'APPROVED',

      expenseDate:
        options.expenseDate
        ?? new Date(
          '2026-09-15T12:00:00.000Z',
        ),

      supplierName:
        'Fournisseur TVA Test',

      description:
        'Dépense de test qualification TVA',

      currency: 'EUR',

      amountExclTax:
        '100.00',

      taxRate:
        '20.00',

      taxAmount:
        options.taxAmount
        ?? '20.00',

      amountInclTax:
        '120.00',

      paymentMethod:
        'CARD',

      reimbursable:
        false,
    },
  })
}

describe(
  'Qualification fiscale TVA des dépenses',
  () => {
    beforeAll(async () => {
      vi.stubGlobal(
        'defineEventHandler',
        (handler: unknown) => handler,
      )

      taxReviewHandler = (
        await import(
          '../../server/api/expenses/[id]/tax-review.post'
        )
      ).default

      await prisma.association.create({
        data: {
          id: associationId,
          name:
            'Association Tax Review Test',
        },
      })

      await prisma.association.create({
        data: {
          id: foreignAssociationId,
          name:
            'Association étrangère Tax Review',
        },
      })

      const role
        = await prisma.role.create({
          data: {
            associationId,
            name:
              'Rôle Tax Review Test',
            code:
              `TAX_REVIEW_${token}`.slice(
                0,
                50,
              ),
            permissions: [],
            isSystemRole: false,
          },
        })

      const user
        = await prisma.user.create({
          data: {
            associationId,
            roleId: role.id,
            email:
              `tax-review-${token}@example.invalid`,
            firstName: 'Tax',
            lastName: 'Reviewer',
            passwordHash:
              'integration-test-not-used',
            status: 'ACTIVE',
          },
        })

      userId = user.id

      const foreign
        = await createExpense({
          associationId:
            foreignAssociationId,
        })

      foreignExpenseId = foreign.id
    })

    beforeEach(async () => {
      await prisma.auditLog.deleteMany({
        where: {
          associationId,
          action:
            'EXPENSE_TAX_REVIEWED',
        },
      })

      await prisma.expense.deleteMany({
        where: {
          associationId,
          id: {
            not:
              foreignExpenseId,
          },
        },
      })

      request.associationId
        = associationId

      request.userId
        = userId

      request.expenseId
        = ''

      request.permissions
        = ['accounting:write']

      request.body = {}
    })

    afterAll(async () => {
      await prisma.association
        .delete({
          where: {
            id: associationId,
          },
        })
        .catch(() => undefined)

      await prisma.association
        .delete({
          where: {
            id: foreignAssociationId,
          },
        })
        .catch(() => undefined)

      vi.unstubAllGlobals()
      await prisma.$disconnect()
    })

    it(
      'refuse sans accounting:write',
      async () => {
        const expense
          = await createExpense()

        request.expenseId
          = expense.id

        request.permissions = []

        request.body = {
          taxDeductibility:
            'DEDUCTIBLE',

          deductibleTaxAmount:
            20,
        }

        await expect(
          taxReviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,

          data:
            expect.objectContaining({
              code: 'FORBIDDEN',
            }),
        })

        const stored
          = await prisma.expense
            .findUniqueOrThrow({
              where: {
                id: expense.id,
              },
            })

        expect(
          stored.taxDeductibility,
        ).toBe('PENDING')

        expect(
          Number(
            stored.deductibleTaxAmount,
          ),
        ).toBe(0)
      },
    )

    it(
      'refuse une dépense hors association',
      async () => {
        request.expenseId
          = foreignExpenseId

        request.body = {
          taxDeductibility:
            'DEDUCTIBLE',

          deductibleTaxAmount:
            20,
        }

        await expect(
          taxReviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it.each([
      'DRAFT',
      'SUBMITTED',
    ] as const)(
      'refuse une dépense %s',
      async (status) => {
        const expense
          = await createExpense({
            status,
          })

        request.expenseId
          = expense.id

        request.body = {
          taxDeductibility:
            'DEDUCTIBLE',

          deductibleTaxAmount:
            20,
        }

        await expect(
          taxReviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })
      },
    )

    it(
      'enregistre une TVA totalement déductible avec audit réel',
      async () => {
        const expense
          = await createExpense()

        request.expenseId
          = expense.id

        request.body = {
          taxDeductibility:
            'DEDUCTIBLE',

          deductibleTaxAmount:
            20,
        }

        const result
          = await taxReviewHandler(event)

        expect(
          result.data.taxDeductibility,
        ).toBe('DEDUCTIBLE')

        expect(
          Number(
            result.data
              .deductibleTaxAmount,
          ),
        ).toBe(20)

        const stored
          = await prisma.expense
            .findUniqueOrThrow({
              where: {
                id: expense.id,
              },
            })

        expect(
          stored.taxReviewedByUserId,
        ).toBe(userId)

        expect(
          stored.taxReviewedAt,
        ).not.toBeNull()

        const audit
          = await prisma.auditLog
            .findFirst({
              where: {
                associationId,
                entityType:
                  'Expense',
                entityId:
                  expense.id,
                action:
                  'EXPENSE_TAX_REVIEWED',
              },
            })

        expect(audit)
          .not.toBeNull()
      },
    )

    it(
      'autorise une déductibilité partielle avec justification',
      async () => {
        const expense
          = await createExpense()

        request.expenseId
          = expense.id

        request.body = {
          taxDeductibility:
            'DEDUCTIBLE',

          deductibleTaxAmount:
            8,

          taxReviewNote:
            'Déductibilité partielle justifiée pour le contrôle comptable.',
        }

        const result
          = await taxReviewHandler(event)

        expect(
          Number(
            result.data
              .deductibleTaxAmount,
          ),
        ).toBe(8)

        expect(
          result.data.taxReviewNote,
        ).toContain(
          'Déductibilité partielle',
        )
      },
    )

    it(
      'refuse une déductibilité partielle sans justification',
      async () => {
        const expense
          = await createExpense()

        request.expenseId
          = expense.id

        request.body = {
          taxDeductibility:
            'DEDUCTIBLE',

          deductibleTaxAmount:
            8,
        }

        await expect(
          taxReviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 400,
        })
      },
    )

    it(
      'refuse un montant déductible supérieur à la TVA enregistrée',
      async () => {
        const expense
          = await createExpense()

        request.expenseId
          = expense.id

        request.body = {
          taxDeductibility:
            'DEDUCTIBLE',

          deductibleTaxAmount:
            20.01,
        }

        await expect(
          taxReviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 400,
        })
      },
    )

    it(
      'enregistre explicitement une TVA non déductible',
      async () => {
        const expense
          = await createExpense()

        request.expenseId
          = expense.id

        request.body = {
          taxDeductibility:
            'NON_DEDUCTIBLE',

          deductibleTaxAmount:
            0,

          taxReviewNote:
            'TVA non retenue comme déductible.',
        }

        const result
          = await taxReviewHandler(event)

        expect(
          result.data.taxDeductibility,
        ).toBe('NON_DEDUCTIBLE')

        expect(
          Number(
            result.data
              .deductibleTaxAmount,
          ),
        ).toBe(0)
      },
    )

    it(
      'refuse la qualification fiscale lorsque la période est pré-clôturée',
      async () => {
        const fiscalYear
          = await prisma
            .accountingFiscalYear
            .create({
              data: {
                associationId,

                label:
                  `Exercice verrou ${token}`,

                startDate:
                  new Date(
                    '2026-01-01T00:00:00.000Z',
                  ),

                endDate:
                  new Date(
                    '2026-12-31T23:59:59.999Z',
                  ),

                periods: {
                  create: {
                    associationId,
                    number: 9,
                    label:
                      'Septembre verrouillé',

                    startDate:
                      new Date(
                        '2026-09-01T00:00:00.000Z',
                      ),

                    endDate:
                      new Date(
                        '2026-09-30T23:59:59.999Z',
                      ),

                    status:
                      'PRE_CLOSED',
                  },
                },
              },

              include: {
                periods: true,
              },
            })

        try {
          const expense
            = await createExpense({
              expenseDate:
                new Date(
                  '2026-09-15T12:00:00.000Z',
                ),
            })

          request.expenseId
            = expense.id

          request.body = {
            taxDeductibility:
              'DEDUCTIBLE',

            deductibleTaxAmount:
              20,
          }

          await expect(
            taxReviewHandler(event),
          ).rejects.toMatchObject({
            statusCode: 409,

            data:
              expect.objectContaining({
                code:
                  'ACCOUNTING_PERIOD_LOCKED',
              }),
          })
        }
        finally {
          await prisma
            .accountingFiscalYear
            .delete({
              where: {
                id: fiscalYear.id,
              },
            })
            .catch(() => undefined)
        }
      },
    )
  },
)
