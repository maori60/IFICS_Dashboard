import type { Prisma } from '../../../generated/prisma/client'
import { buildAccountingPeriodChecklist } from '../../utils/accounting-checklist'
import { hasPermission, requireAuth } from '../../utils/auth'
import {
  businessDateAsUtc,
  businessMonthRange,
  DEFAULT_BUSINESS_TIMEZONE,
  previousBusinessMonthRange,
} from '../../utils/business-date'
import { success } from '../../utils/api'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'

type DashboardAccountingItem = {
  code: string
  label: string
  count: number
  message: string
}

type DashboardAccounting = {
  configured: boolean

  currentPeriod: null | {
    id: string
    label: string
    status: string
    startDate: Date
    endDate: Date

    fiscalYear: {
      id: string
      label: string
      status: string
    }
  }

  checklist: null | {
    periodEnded: boolean
    priorUnclosedPeriods: number
    actionableBlockerCount: number
    warningCount: number
    blockers: DashboardAccountingItem[]
    warnings: DashboardAccountingItem[]
  }
}

function decimal(value: unknown): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

function variation(current: number, previous: number): number | null {
  if (previous === 0) return null

  return Math.round(
    ((current - previous) / previous) * 1000,
  ) / 10
}

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  const association
    = await prisma.association.findUnique({
      where: {
        id: context.associationId,
      },

      select: {
        timezone: true,
      },
    })

  const timeZone
    = association?.timezone
      || DEFAULT_BUSINESS_TIMEZONE

  const now = new Date()

  const currentBusinessDate
    = businessDateAsUtc(
      now,
      timeZone,
    )

  const currentMonth
    = businessMonthRange(
      now,
      timeZone,
    )

  const previousMonth
    = previousBusinessMonthRange(
      now,
      timeZone,
    )

  const canReadBilling = hasPermission(
    context,
    PERMISSIONS.BILLING_READ,
  )

  const canReadAllExpenses = hasPermission(
    context,
    PERMISSIONS.EXPENSE_READ_ALL,
  )

  const canReadOwnExpenses = hasPermission(
    context,
    PERMISSIONS.EXPENSE_READ_OWN,
  )

  const canReadProjects = hasPermission(
    context,
    PERMISSIONS.PROJECT_READ,
  )

  const canReadClients = hasPermission(
    context,
    PERMISSIONS.CLIENT_READ,
  )

  const canReadIntervenors = hasPermission(
    context,
    PERMISSIONS.INTERVENOR_READ,
  )

  const canReadAllCra = hasPermission(
    context,
    PERMISSIONS.CRA_READ_ALL,
  )

  const canReadOwnCra = hasPermission(
    context,
    PERMISSIONS.CRA_READ_OWN,
  )

  const canReadAccounting = hasPermission(
    context,
    PERMISSIONS.ACCOUNTING_READ,
  )

  const billingScope: Prisma.BillingDocumentWhereInput = {
    associationId: context.associationId,
    kind: 'INVOICE',
    ...(context.clientId
      ? { clientId: context.clientId }
      : {}),
  }

  const expenseScope: Prisma.ExpenseWhereInput | null
    = canReadAllExpenses
      ? {
          associationId: context.associationId,
          archivedAt: null,
        }
      : canReadOwnExpenses
        ? {
            associationId: context.associationId,
            archivedAt: null,
            OR: [
              { createdByUserId: context.userId },
              ...(context.intervenorId
                ? [{ intervenorId: context.intervenorId }]
                : []),
            ],
          }
        : null

  const craScope: Prisma.CraReportWhereInput | null
    = canReadAllCra
      ? {
          associationId: context.associationId,
        }
      : canReadOwnCra && context.intervenorId
        ? {
            associationId: context.associationId,
            intervenorId: context.intervenorId,
          }
        : null

  let finance = null

  if (canReadBilling) {
    const [
      currentRevenue,
      previousRevenue,
      currentCollected,
      receivables,
      receivablePayments,
      overdue,
      overduePayments,
      invoiceStatuses,
      recentInvoices,
    ] = await Promise.all([
      prisma.billingDocument.aggregate({
        where: {
          ...billingScope,
          issueDate: {
            gte: currentMonth.start,
            lt: currentMonth.end,
          },
          status: {
            in: [
              'ISSUED',
              'SENT',
              'ACCEPTED',
              'PARTIALLY_PAID',
              'PAID',
              'OVERDUE',
            ],
          },
        },
        _sum: {
          subtotal: true,
          taxAmount: true,
          total: true,
        },
        _count: true,
      }),

      prisma.billingDocument.aggregate({
        where: {
          ...billingScope,
          issueDate: {
            gte: previousMonth.start,
            lt: previousMonth.end,
          },
          status: {
            in: [
              'ISSUED',
              'SENT',
              'ACCEPTED',
              'PARTIALLY_PAID',
              'PAID',
              'OVERDUE',
            ],
          },
        },
        _sum: {
          subtotal: true,
          taxAmount: true,
          total: true,
        },
        _count: true,
      }),

      prisma.billingPayment.aggregate({
        where: {
          associationId: context.associationId,
          reversedAt: null,
          paidAt: {
            gte: currentMonth.start,
            lt: currentMonth.end,
          },
          billingDocument: {
            is: billingScope,
          },
        },
        _sum: {
          amount: true,
        },
        _count: true,
      }),

      prisma.billingDocument.aggregate({
        where: {
          ...billingScope,
          status: {
            in: [
              'ISSUED',
              'SENT',
              'ACCEPTED',
              'PARTIALLY_PAID',
              'OVERDUE',
            ],
          },
        },
        _sum: {
          total: true,
        },
        _count: true,
      }),

      prisma.billingPayment.aggregate({
        where: {
          associationId: context.associationId,
          reversedAt: null,
          billingDocument: {
            is: {
              ...billingScope,
              status: {
                in: [
                  'ISSUED',
                  'SENT',
                  'ACCEPTED',
                  'PARTIALLY_PAID',
                  'OVERDUE',
                ],
              },
            },
          },
        },
        _sum: { amount: true },
      }),

      prisma.billingDocument.aggregate({
        where: {
          ...billingScope,
          dueDate: {
            lt: currentBusinessDate,
          },
          status: {
            in: [
              'ISSUED',
              'SENT',
              'ACCEPTED',
              'PARTIALLY_PAID',
              'OVERDUE',
            ],
          },
        },
        _sum: {
          total: true,
        },
        _count: true,
      }),

      prisma.billingPayment.aggregate({
        where: {
          associationId: context.associationId,
          reversedAt: null,
          billingDocument: {
            is: {
              ...billingScope,
              dueDate: { lt: currentBusinessDate },
              status: {
                in: [
                  'ISSUED',
                  'SENT',
                  'ACCEPTED',
                  'PARTIALLY_PAID',
                  'OVERDUE',
                ],
              },
            },
          },
        },
        _sum: { amount: true },
      }),

      prisma.billingDocument.groupBy({
        by: ['status'],
        where: billingScope,
        _count: {
          _all: true,
        },
      }),

      prisma.billingDocument.findMany({
        where: billingScope,
        orderBy: [
          { issueDate: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 5,
        select: {
          id: true,
          number: true,
          status: true,
          issueDate: true,
          dueDate: true,
          total: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              reference: true,
              title: true,
            },
          },
        },
      }),
    ])

    const currentHt = decimal(currentRevenue._sum.subtotal)
    const previousHt = decimal(previousRevenue._sum.subtotal)

    finance = {
      month: {
        revenueExclTax: currentHt,
        revenueTax: decimal(currentRevenue._sum.taxAmount),
        revenueInclTax: decimal(currentRevenue._sum.total),
        invoiceCount: currentRevenue._count,
        collectedInclTax: decimal(currentCollected._sum.amount),
        collectedInvoiceCount: currentCollected._count,
        revenueVariationPercent: variation(
          currentHt,
          previousHt,
        ),
      },

      previousMonth: {
        revenueExclTax: previousHt,
        revenueTax: decimal(previousRevenue._sum.taxAmount),
        revenueInclTax: decimal(previousRevenue._sum.total),
        invoiceCount: previousRevenue._count,
      },

      receivables: {
        grossAmount: decimal(receivables._sum.total),
        paidAmount: decimal(receivablePayments._sum.amount),
        outstandingAmount: Math.max(
          0,
          decimal(receivables._sum.total)
          - decimal(receivablePayments._sum.amount),
        ),
        invoiceCount: receivables._count,
        note: 'Solde calculé à partir des règlements clients enregistrés.',
      },

      overdue: {
        grossAmount: decimal(overdue._sum.total),
        paidAmount: decimal(overduePayments._sum.amount),
        outstandingAmount: Math.max(
          0,
          decimal(overdue._sum.total)
          - decimal(overduePayments._sum.amount),
        ),
        invoiceCount: overdue._count,
      },

      statuses: Object.fromEntries(
        invoiceStatuses.map(item => [
          item.status,
          item._count._all,
        ]),
      ),

      recentInvoices: recentInvoices.map(invoice => ({
        ...invoice,
        total: decimal(invoice.total),
      })),
    }
  }

  let expenses = null

  if (expenseScope) {
    const [
      monthExpenses,
      pendingReview,
      pendingPayment,
      recentExpenses,
    ] = await Promise.all([
      prisma.expense.aggregate({
        where: {
          ...expenseScope,
          expenseDate: {
            gte: currentMonth.start,
            lt: currentMonth.end,
          },
          status: {
            in: [
              'SUBMITTED',
              'APPROVED',
              'PAID',
            ],
          },
        },
        _sum: {
          amountExclTax: true,
          taxAmount: true,
          amountInclTax: true,
        },
        _count: true,
      }),

      prisma.expense.count({
        where: {
          ...expenseScope,
          status: 'SUBMITTED',
        },
      }),

      prisma.expense.aggregate({
        where: {
          ...expenseScope,
          status: 'APPROVED',
        },
        _sum: {
          amountInclTax: true,
        },
        _count: true,
      }),

      prisma.expense.findMany({
        where: expenseScope,
        orderBy: [
          { expenseDate: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 5,
        select: {
          id: true,
          category: true,
          status: true,
          expenseDate: true,
          supplierName: true,
          description: true,
          amountInclTax: true,
          taxAmount: true,
          reimbursable: true,
        },
      }),
    ])

    expenses = {
      month: {
        amountExclTax: decimal(
          monthExpenses._sum.amountExclTax,
        ),
        taxAmount: decimal(
          monthExpenses._sum.taxAmount,
        ),
        amountInclTax: decimal(
          monthExpenses._sum.amountInclTax,
        ),
        count: monthExpenses._count,
      },

      pendingReview,

      pendingPayment: {
        count: pendingPayment._count,
        amountInclTax: decimal(
          pendingPayment._sum.amountInclTax,
        ),
      },

      recentExpenses: recentExpenses.map(expense => ({
        ...expense,
        amountInclTax: decimal(expense.amountInclTax),
        taxAmount: decimal(expense.taxAmount),
      })),
    }
  }

  const activity = {
    projects: null as null | {
      active: number
    },

    clients: null as null | {
      active: number
    },

    intervenors: null as null | {
      active: number
    },

    cra: null as null | {
      draft: number
      submitted: number
      reviewed: number
      validated: number
      refused: number
    },
  }

  if (canReadProjects) {
    activity.projects = {
      active: await prisma.project.count({
        where: {
          associationId: context.associationId,
          archivedAt: null,
          status: {
            not: 'CANCELLED',
          },
          startDate: {
            lte: now,
          },
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      }),
    }
  }

  if (canReadClients) {
    activity.clients = {
      active: await prisma.client.count({
        where: {
          associationId: context.associationId,
          archivedAt: null,
          status: 'ACTIVE',
        },
      }),
    }
  }

  if (canReadIntervenors) {
    activity.intervenors = {
      active: await prisma.intervenor.count({
        where: {
          associationId: context.associationId,
          archivedAt: null,
          status: 'ACTIVE',
        },
      }),
    }
  }

  if (craScope) {
    const craStatuses = await prisma.craReport.groupBy({
      by: ['status'],
      where: craScope,
      _count: {
        _all: true,
      },
    })

    const counts = Object.fromEntries(
      craStatuses.map(item => [
        item.status,
        item._count._all,
      ]),
    )

    activity.cra = {
      draft: counts.DRAFT ?? 0,
      submitted: counts.SUBMITTED ?? 0,
      reviewed: counts.REVIEWED ?? 0,
      validated: counts.VALIDATED ?? 0,
      refused: counts.REFUSED ?? 0,
    }
  }

  let accounting: DashboardAccounting | null = null

  if (canReadAccounting) {
    const currentAccountingPeriod
      = await prisma.accountingPeriod.findFirst({
        where: {
          associationId:
            context.associationId,

          startDate: {
            lte: currentBusinessDate,
          },

          endDate: {
            gte: currentBusinessDate,
          },
        },

        select: {
          id: true,
        },
      })

    if (!currentAccountingPeriod) {
      accounting = {
        configured: false,
        currentPeriod: null,
        checklist: null,
      }
    }
    else {
      const currentChecklist
        = await buildAccountingPeriodChecklist(
          context.associationId,
          currentAccountingPeriod.id,
        )

      /*
       * La fin normale du mois n'est pas considérée
       * comme une anomalie sur le dashboard.
       *
       * Même logique pour l'ordre chronologique :
       * il dispose de son propre compteur afin de
       * ne pas mélanger "7 périodes précédentes"
       * avec "1 catégorie de contrôle".
       */
      const actionableBlockers
        = currentChecklist.items.filter(
          item =>
            item.status === 'BLOCKER'
            && item.code !== 'PERIOD_NOT_ENDED'
            && item.code !== 'PRIOR_PERIODS_NOT_CLOSED',
        )

      const warnings
        = currentChecklist.items.filter(
          item =>
            item.status === 'WARNING',
        )

      accounting = {
        configured: true,

        currentPeriod: {
          id:
            currentChecklist.period.id,

          label:
            currentChecklist.period.label,

          status:
            currentChecklist.period.status,

          startDate:
            currentChecklist.period.startDate,

          endDate:
            currentChecklist.period.endDate,

          fiscalYear: {
            id:
              currentChecklist.period
                .fiscalYear.id,

            label:
              currentChecklist.period
                .fiscalYear.label,

            status:
              currentChecklist.period
                .fiscalYear.status,
          },
        },

        checklist: {
          periodEnded:
            currentChecklist.metrics
              .periodEnded,

          priorUnclosedPeriods:
            currentChecklist.metrics
              .priorUnclosedPeriods,

          actionableBlockerCount:
            actionableBlockers.reduce(
              (
                total,
                item,
              ) =>
                total + item.count,
              0,
            ),

          warningCount:
            warnings.reduce(
              (
                total,
                item,
              ) =>
                total + item.count,
              0,
            ),

          blockers:
            actionableBlockers.map(
              item => ({
                code: item.code,
                label: item.label,
                count: item.count,
                message: item.message,
              }),
            ),

          warnings:
            warnings.map(
              item => ({
                code: item.code,
                label: item.label,
                count: item.count,
                message: item.message,
              }),
            ),
        },
      }
    }
  }

  const alerts = {
    overdueInvoices:
      finance?.overdue.invoiceCount ?? 0,

    expensesToReview:
      expenses?.pendingReview ?? 0,

    expensesToPay:
      expenses?.pendingPayment.count ?? 0,

    craToReview:
      canReadAllCra
        ? activity.cra?.submitted ?? 0
        : 0,

    accountingPeriodsToClose:
      accounting?.checklist
        ?.priorUnclosedPeriods ?? 0,

    accountingBlockers:
      accounting?.checklist
        ?.actionableBlockerCount ?? 0,

    accountingConfiguration:
      canReadAccounting
      && accounting
      && !accounting.configured
        ? 1
        : 0,
  }

  const grossMarginEstimateExclTax
    = finance && expenses
      ? finance.month.revenueExclTax
        - expenses.month.amountExclTax
      : null

  return success({
    generatedAt: now.toISOString(),

    period: {
      year: currentMonth.year,
      month: currentMonth.month,
      start: currentMonth.start.toISOString(),
      end: currentMonth.end.toISOString(),
    },

    finance,

    expenses,

    accounting,

    activity,

    alerts,

    indicators: {
      grossMarginEstimateExclTax,
      note:
        'La marge affichée est un indicateur de pilotage, pas un résultat comptable ou fiscal.',
    },
  })
})
