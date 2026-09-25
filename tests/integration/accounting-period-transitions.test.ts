import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  assertAccountingDateWritable,
} from '../../server/utils/accounting-periods'

import { prisma } from '../../server/utils/prisma'

let transitionHandler:
  typeof import(
    '../../server/api/accounting/periods/[id]/transition.post'
  )['default']

const request = vi.hoisted(() => ({
  associationId: '',
  userId: '',
  periodId: '',

  permissions: [
    '*',
  ] as string[],

  body: {} as Record<
    string,
    unknown
  >,
}))

vi.mock(
  'h3',
  async (importOriginal) => {
    const actual
      = await importOriginal<
        typeof import('h3')
      >()

    return {
      ...actual,

      readBody:
        async () =>
          request.body,

      getRouterParam:
        (
          _event: unknown,
          name: string,
        ) =>
          name === 'id'
            ? request.periodId
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
        typeof import(
          '../../server/utils/auth'
        )
      >()

    return {
      ...actual,

      requireAuth:
        async () => ({
          sessionId:
            'accounting-transition-test',

          userId:
            request.userId,

          associationId:
            request.associationId,

          clientId:
            null,

          intervenorId:
            null,

          email:
            'accounting-transition-test@example.invalid',

          firstName:
            'Test',

          lastName:
            'Comptabilité',

          roleCode:
            'ADMIN',

          roleName:
            'Administrateur',

          permissions:
            request.permissions,

          mfaEnabled:
            true,

          mfaVerified:
            true,

          mfaSetupRequired:
            false,
        }),

      hasPermission:
        (
          context: {
            permissions: string[]
          },
          permission: string,
        ) =>
          context.permissions.includes('*')
          || context.permissions.includes(
            permission,
          ),

      /*
       * L'audit reste RÉEL.
       * On neutralise seulement l'IP car
       * l'événement de test n'a pas de socket HTTP.
       */
      getIpHash:
        () => null,
    }
  },
)

describe.skipIf(
  process.env
    .ACCOUNTING_INTEGRATION_TESTS !== '1',
)(
  'Cycle transactionnel des périodes comptables',
  () => {
    const token
      = `${Date.now()}-${process.pid}`

    const associationId
      = `accounting-transition-${token}`

    let userId = ''
    let periodId = ''

    const event = {
      context: {
        requestId:
          `accounting-transition-${token}`,
      },
    } as never

    beforeAll(async () => {
      /*
       * defineEventHandler est normalement injecté
       * automatiquement par Nuxt/Nitro.
       *
       * Dans ce test Vitest isolé, on fournit
       * explicitement son comportement minimal
       * avant d'importer la route.
       */
      vi.stubGlobal(
        'defineEventHandler',
        (handler: unknown) => handler,
      )

      const transitionModule
        = await import(
          '../../server/api/accounting/periods/[id]/transition.post'
        )

      transitionHandler
        = transitionModule.default

      await prisma.association.create({
        data: {
          id: associationId,
          name:
            'Association test clôture',
        },
      })

      const role
        = await prisma.role.create({
          data: {
            associationId,

            name:
              `Admin comptable ${token}`,

            code:
              `ACCOUNTING_TEST_${token}`,

            permissions: [
              '*',
            ],
          },
        })

      const user
        = await prisma.user.create({
          data: {
            associationId,
            roleId: role.id,

            firstName:
              'Test',

            lastName:
              'Comptabilité',

            email:
              `accounting-${token}@example.invalid`,

            passwordHash:
              'integration-test-not-used',
          },
        })

      userId = user.id

      const fiscalYear
        = await prisma
          .accountingFiscalYear
          .create({
            data: {
              associationId,

              label:
                'Exercice de test 2026',

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

                  number: 1,

                  label:
                    'Janvier 2026',

                  startDate:
                    new Date(
                      '2026-01-01T00:00:00.000Z',
                    ),

                  endDate:
                    new Date(
                      '2026-01-31T23:59:59.999Z',
                    ),

                  status:
                    'OPEN',
                },
              },
            },

            include: {
              periods: true,
            },
          })

      periodId
        = fiscalYear.periods[0]!.id

      request.associationId
        = associationId

      request.userId
        = userId

      request.periodId
        = periodId
    })

    afterAll(async () => {
      await prisma.association
        .delete({
          where: {
            id: associationId,
          },
        })
        .catch(() => undefined)

      vi.unstubAllGlobals()
    })

    it(
      'exécute OPEN → REVIEW → PRE_CLOSED → CLOSED → REVIEW avec audit réel',
      async () => {
        /*
         * OPEN → REVIEW
         */
        request.body = {
          action:
            'START_REVIEW',

          lockVersion:
            0,

          confirmed:
            true,
        }

        await transitionHandler(
          event,
        )

        let period
          = await prisma
            .accountingPeriod
            .findUniqueOrThrow({
              where: {
                id: periodId,
              },
            })

        expect(
          period.status,
        ).toBe('REVIEW')

        expect(
          period.lockVersion,
        ).toBe(1)

        expect(
          period.reviewStartedByUserId,
        ).toBe(userId)


        /*
         * Une ancienne version doit être rejetée.
         */
        request.body = {
          action:
            'PRE_CLOSE',

          lockVersion:
            0,

          confirmed:
            true,
        }

        await expect(
          transitionHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,

          data:
            expect.objectContaining({
              code:
                'ACCOUNTING_PERIOD_VERSION_CONFLICT',
            }),
        })

        period
          = await prisma
            .accountingPeriod
            .findUniqueOrThrow({
              where: {
                id: periodId,
              },
            })

        expect(
          period.status,
        ).toBe('REVIEW')

        expect(
          period.lockVersion,
        ).toBe(1)


        /*
         * REVIEW → PRE_CLOSED
         */
        request.body = {
          action:
            'PRE_CLOSE',

          lockVersion:
            1,

          confirmed:
            true,
        }

        await transitionHandler(
          event,
        )

        period
          = await prisma
            .accountingPeriod
            .findUniqueOrThrow({
              where: {
                id: periodId,
              },
            })

        expect(
          period.status,
        ).toBe('PRE_CLOSED')

        expect(
          period.lockVersion,
        ).toBe(2)

        expect(
          period.preClosedByUserId,
        ).toBe(userId)

        expect(
          period.closureChecklist,
        ).not.toBeNull()


        /*
         * Le verrou métier doit être immédiatement
         * visible pour les écritures financières.
         */
        await expect(
          assertAccountingDateWritable(
            associationId,

            new Date(
              '2026-01-15T12:00:00.000Z',
            ),

            'opération de test',
          ),
        ).rejects.toMatchObject({
          statusCode: 409,

          data:
            expect.objectContaining({
              code:
                'ACCOUNTING_PERIOD_LOCKED',
            }),
        })


        /*
         * PRE_CLOSED → CLOSED
         */
        request.body = {
          action:
            'CLOSE',

          lockVersion:
            2,

          confirmed:
            true,
        }

        await transitionHandler(
          event,
        )

        period
          = await prisma
            .accountingPeriod
            .findUniqueOrThrow({
              where: {
                id: periodId,
              },
            })

        expect(
          period.status,
        ).toBe('CLOSED')

        expect(
          period.lockVersion,
        ).toBe(3)

        expect(
          period.closedByUserId,
        ).toBe(userId)


        /*
         * CLOSED → REVIEW avec motif.
         */
        request.body = {
          action:
            'REOPEN',

          lockVersion:
            3,

          confirmed:
            true,

          reason:
            'Correction comptable nécessaire après contrôle.',
        }

        await transitionHandler(
          event,
        )

        period
          = await prisma
            .accountingPeriod
            .findUniqueOrThrow({
              where: {
                id: periodId,
              },
            })

        expect(
          period.status,
        ).toBe('REVIEW')

        expect(
          period.lockVersion,
        ).toBe(4)

        expect(
          period.reopenedByUserId,
        ).toBe(userId)

        expect(
          period.reopenReason,
        ).toBe(
          'Correction comptable nécessaire après contrôle.',
        )

        expect(
          period.preClosedAt,
        ).toBeNull()

        expect(
          period.closedAt,
        ).toBeNull()


        /*
         * L'audit n'est PAS mocké :
         * les quatre traces doivent être réellement
         * présentes en base.
         */
        const audits
          = await prisma.auditLog.findMany({
            where: {
              associationId,

              entityType:
                'AccountingPeriod',

              entityId:
                periodId,

              action: {
                in: [
                  'ACCOUNTING_PERIOD_REVIEW_STARTED',
                  'ACCOUNTING_PERIOD_PRE_CLOSED',
                  'ACCOUNTING_PERIOD_CLOSED',
                  'ACCOUNTING_PERIOD_REOPENED',
                ],
              },
            },

            select: {
              action: true,
            },
          })

        expect(
          audits,
        ).toHaveLength(4)

        expect(
          audits.map(
            audit =>
              audit.action,
          ),
        ).toEqual(
          expect.arrayContaining([
            'ACCOUNTING_PERIOD_REVIEW_STARTED',
            'ACCOUNTING_PERIOD_PRE_CLOSED',
            'ACCOUNTING_PERIOD_CLOSED',
            'ACCOUNTING_PERIOD_REOPENED',
          ]),
        )
      },
    )

    it(
      'impose la clôture chronologique et la réouverture en ordre inverse',
      async () => {
        const fiscalYear
          = await prisma
            .accountingFiscalYear
            .create({
              data: {
                associationId,

                label:
                  'Exercice test ordre 2025',

                startDate:
                  new Date(
                    '2025-01-01T00:00:00.000Z',
                  ),

                endDate:
                  new Date(
                    '2025-12-31T23:59:59.999Z',
                  ),

                periods: {
                  create: [
                    {
                      associationId,
                      number: 1,
                      label:
                        'Janvier 2025',

                      startDate:
                        new Date(
                          '2025-01-01T00:00:00.000Z',
                        ),

                      endDate:
                        new Date(
                          '2025-01-31T23:59:59.999Z',
                        ),
                    },
                    {
                      associationId,
                      number: 2,
                      label:
                        'Février 2025',

                      startDate:
                        new Date(
                          '2025-02-01T00:00:00.000Z',
                        ),

                      endDate:
                        new Date(
                          '2025-02-28T23:59:59.999Z',
                        ),
                    },
                  ],
                },
              },

              include: {
                periods: {
                  orderBy: {
                    number: 'asc',
                  },
                },
              },
            })

        const januaryId
          = fiscalYear.periods[0]!.id

        const februaryId
          = fiscalYear.periods[1]!.id

        /*
         * Février peut entrer en contrôle,
         * mais ne peut pas être pré-clôturé
         * tant que janvier n'est pas clôturé.
         */
        request.periodId = februaryId

        request.body = {
          action:
            'START_REVIEW',

          lockVersion:
            0,

          confirmed:
            true,
        }

        await transitionHandler(event)

        request.body = {
          action:
            'PRE_CLOSE',

          lockVersion:
            1,

          confirmed:
            true,
        }

        await expect(
          transitionHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,

          data:
            expect.objectContaining({
              code:
                'ACCOUNTING_PERIOD_CHECKLIST_BLOCKED',
            }),
        })


        /*
         * On clôture janvier.
         */
        request.periodId = januaryId

        for (
          const [action, lockVersion]
          of [
            [
              'START_REVIEW',
              0,
            ],
            [
              'PRE_CLOSE',
              1,
            ],
            [
              'CLOSE',
              2,
            ],
          ] as const
        ) {
          request.body = {
            action,
            lockVersion,
            confirmed: true,
          }

          await transitionHandler(event)
        }


        /*
         * Février peut maintenant être clôturé.
         */
        request.periodId = februaryId

        request.body = {
          action:
            'PRE_CLOSE',

          lockVersion:
            1,

          confirmed:
            true,
        }

        await transitionHandler(event)

        request.body = {
          action:
            'CLOSE',

          lockVersion:
            2,

          confirmed:
            true,
        }

        await transitionHandler(event)


        /*
         * Impossible de réouvrir janvier
         * tant que février reste clôturé.
         */
        request.periodId = januaryId

        request.body = {
          action:
            'REOPEN',

          lockVersion:
            3,

          confirmed:
            true,

          reason:
            'Correction nécessaire sur janvier 2025.',
        }

        await expect(
          transitionHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,

          data:
            expect.objectContaining({
              code:
                'ACCOUNTING_PERIOD_REOPEN_ORDER_CONFLICT',
            }),
        })


        /*
         * On remet la période utilisée par
         * les autres tests.
         */
        request.periodId = periodId
      },
    )

    it(
      'refuse une transition sans permission',
      async () => {
        request.permissions = []

        request.body = {
          action:
            'PRE_CLOSE',

          lockVersion:
            4,

          confirmed:
            true,
        }

        await expect(
          transitionHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            403,

          data:
            expect.objectContaining({
              code:
                'ACCOUNTING_PERIOD_FORBIDDEN',
            }),
        })

        request.permissions = [
          '*',
        ]
      },
    )
  },
)
