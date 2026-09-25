import { httpError } from './api'
import {
  DEFAULT_BUSINESS_TIMEZONE,
  isBusinessPeriodEnded,
} from './business-date'
import { prisma } from './prisma'

export type AccountingChecklistStatus =
  | 'OK'
  | 'WARNING'
  | 'BLOCKER'

export type AccountingChecklistItem = {
  code: string
  label: string
  status: AccountingChecklistStatus
  count: number
  message: string
}

export type AccountingChecklistMetrics = {
  periodEnded: boolean
  priorUnclosedPeriods: number

  draftInvoices: number

  draftExpenses: number
  submittedExpenses: number
  rejectedExpenses: number

  expensesWithoutAttachments: number

  outstandingInvoices: number
  outstandingInvoicesAmount: string

  approvedUnpaidExpenses: number
  approvedUnpaidExpensesAmount: string
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function checklistItem(
  code: string,
  label: string,
  count: number,
  severity: 'BLOCKER' | 'WARNING',
  okMessage: string,
  alertMessage: string,
): AccountingChecklistItem {
  return {
    code,
    label,
    count,

    status:
      count === 0
        ? 'OK'
        : severity,

    message:
      count === 0
        ? okMessage
        : alertMessage,
  }
}

export function evaluateAccountingChecklist(
  metrics: AccountingChecklistMetrics,
): {
  readyForPreClose: boolean
  blockerCount: number
  warningCount: number
  items: AccountingChecklistItem[]
} {
  const items: AccountingChecklistItem[] = [
    checklistItem(
      'PERIOD_NOT_ENDED',
      'Période terminée',
      metrics.periodEnded ? 0 : 1,
      'BLOCKER',
      'La période est terminée.',
      'La période est encore en cours et ne peut pas être pré-clôturée.',
    ),

    checklistItem(
      'PRIOR_PERIODS_NOT_CLOSED',
      'Périodes antérieures clôturées',
      metrics.priorUnclosedPeriods,
      'BLOCKER',
      'Toutes les périodes antérieures sont clôturées.',
      metrics.priorUnclosedPeriods === 1
        ? '1 période antérieure doit encore être clôturée.'
        : `${metrics.priorUnclosedPeriods} périodes antérieures doivent encore être clôturées.`,
    ),

    checklistItem(
      'DRAFT_INVOICES',
      'Factures en brouillon',
      metrics.draftInvoices,
      'BLOCKER',
      'Aucune facture en brouillon.',
      `${countLabel(metrics.draftInvoices, 'facture', 'factures')} en brouillon ${metrics.draftInvoices === 1 ? 'doit' : 'doivent'} être traitée${metrics.draftInvoices === 1 ? '' : 's'}.`,
    ),

    checklistItem(
      'DRAFT_EXPENSES',
      'Dépenses en brouillon',
      metrics.draftExpenses,
      'BLOCKER',
      'Aucune dépense en brouillon.',
      `${countLabel(metrics.draftExpenses, 'dépense', 'dépenses')} en brouillon ${metrics.draftExpenses === 1 ? 'doit' : 'doivent'} être traitée${metrics.draftExpenses === 1 ? '' : 's'}.`,
    ),

    checklistItem(
      'SUBMITTED_EXPENSES',
      'Dépenses en attente de validation',
      metrics.submittedExpenses,
      'BLOCKER',
      'Aucune dépense en attente de validation.',
      `${countLabel(metrics.submittedExpenses, 'dépense', 'dépenses')} ${metrics.submittedExpenses === 1 ? 'est' : 'sont'} encore en attente de validation.`,
    ),

    checklistItem(
      'REJECTED_EXPENSES',
      'Dépenses rejetées non régularisées',
      metrics.rejectedExpenses,
      'BLOCKER',
      'Aucune dépense rejetée à régulariser.',
      `${countLabel(metrics.rejectedExpenses, 'dépense rejetée', 'dépenses rejetées')} ${metrics.rejectedExpenses === 1 ? 'doit' : 'doivent'} être régularisée${metrics.rejectedExpenses === 1 ? '' : 's'} ou annulée${metrics.rejectedExpenses === 1 ? '' : 's'}.`,
    ),

    checklistItem(
      'MISSING_EXPENSE_ATTACHMENTS',
      'Justificatifs de dépenses',
      metrics.expensesWithoutAttachments,
      'WARNING',
      'Toutes les dépenses concernées disposent d’un justificatif.',
      `${countLabel(metrics.expensesWithoutAttachments, 'dépense', 'dépenses')} ne ${metrics.expensesWithoutAttachments === 1 ? 'dispose' : 'disposent'} d’aucun justificatif enregistré.`,
    ),

    checklistItem(
      'OUTSTANDING_INVOICES',
      'Factures restant à encaisser',
      metrics.outstandingInvoices,
      'WARNING',
      'Aucune facture de la période ne reste à encaisser.',
      `${countLabel(metrics.outstandingInvoices, 'facture', 'factures')} ${metrics.outstandingInvoices === 1 ? 'reste' : 'restent'} à encaisser pour ${metrics.outstandingInvoicesAmount} € TTC.`,
    ),

    checklistItem(
      'APPROVED_UNPAID_EXPENSES',
      'Dépenses approuvées non réglées',
      metrics.approvedUnpaidExpenses,
      'WARNING',
      'Aucune dépense approuvée ne reste à régler.',
      `${countLabel(metrics.approvedUnpaidExpenses, 'dépense approuvée', 'dépenses approuvées')} ${metrics.approvedUnpaidExpenses === 1 ? 'reste' : 'restent'} à régler pour ${metrics.approvedUnpaidExpensesAmount} € TTC.`,
    ),
  ]

  const blockerCount
    = items.filter(
      item =>
        item.status === 'BLOCKER',
    ).length

  const warningCount
    = items.filter(
      item =>
        item.status === 'WARNING',
    ).length

  return {
    readyForPreClose:
      blockerCount === 0,

    blockerCount,
    warningCount,
    items,
  }
}

type AccountingChecklistDb = Pick<
  typeof prisma,
  | 'association'
  | 'accountingPeriod'
  | 'billingDocument'
  | 'billingPayment'
  | 'expense'
>

export async function buildAccountingPeriodChecklist(
  associationId: string,
  periodId: string,
  db: AccountingChecklistDb = prisma,
) {
  const now = new Date()

  const association
    = await db.association.findUnique({
      where: {
        id: associationId,
      },

      select: {
        timezone: true,
      },
    })

  const timeZone
    = association?.timezone
      || DEFAULT_BUSINESS_TIMEZONE

  const period
    = await db.accountingPeriod.findFirst({
      where: {
        id: periodId,
        associationId,
      },

      select: {
        id: true,
        label: true,
        status: true,
        number: true,
        startDate: true,
        endDate: true,
        lockVersion: true,

        fiscalYear: {
          select: {
            id: true,
            label: true,
            status: true,
          },
        },
      },
    })

  if (!period) {
    httpError(
      404,
      'Période comptable introuvable.',
      'ACCOUNTING_PERIOD_NOT_FOUND',
    )
  }

  const invoiceWhere = {
    associationId,
    kind: 'INVOICE' as const,

    issueDate: {
      gte: period.startDate,
      lte: period.endDate,
    },
  }

  const expenseWhere = {
    associationId,
    archivedAt: null,

    expenseDate: {
      gte: period.startDate,
      lte: period.endDate,
    },
  }

  const [
    priorUnclosedPeriods,

    draftInvoices,

    draftExpenses,
    submittedExpenses,
    rejectedExpenses,

    expensesWithoutAttachments,

    outstandingInvoices,
    outstandingInvoicesAggregate,
    outstandingPaymentsAggregate,

    approvedUnpaidExpenses,
    approvedUnpaidExpensesAggregate,
  ] = await Promise.all([
    db.accountingPeriod.count({
      where: {
        associationId,
        fiscalYearId:
          period.fiscalYear.id,

        number: {
          lt: period.number,
        },

        status: {
          not: 'CLOSED',
        },
      },
    }),

    db.billingDocument.count({
      where: {
        ...invoiceWhere,
        status: 'DRAFT',
      },
    }),

    db.expense.count({
      where: {
        ...expenseWhere,
        status: 'DRAFT',
      },
    }),

    db.expense.count({
      where: {
        ...expenseWhere,
        status: 'SUBMITTED',
      },
    }),

    db.expense.count({
      where: {
        ...expenseWhere,
        status: 'REJECTED',
      },
    }),

    db.expense.count({
      where: {
        ...expenseWhere,

        status: {
          not: 'CANCELLED',
        },

        attachments: {
          none: {},
        },
      },
    }),

    db.billingDocument.count({
      where: {
        ...invoiceWhere,

        status: {
          in: [
            'ISSUED',
            'SENT',
            'PARTIALLY_PAID',
            'OVERDUE',
          ],
        },
      },
    }),

    db.billingDocument.aggregate({
      where: {
        ...invoiceWhere,

        status: {
          in: [
            'ISSUED',
            'SENT',
            'PARTIALLY_PAID',
            'OVERDUE',
          ],
        },
      },

      _sum: {
        total: true,
      },
    }),

    db.billingPayment.aggregate({
      where: {
        associationId,
        reversedAt: null,
        billingDocument: {
          is: {
            ...invoiceWhere,
            status: {
              in: [
                'ISSUED',
                'SENT',
                'PARTIALLY_PAID',
                'OVERDUE',
              ],
            },
          },
        },
      },
      _sum: { amount: true },
    }),

    db.expense.count({
      where: {
        ...expenseWhere,
        status: 'APPROVED',
      },
    }),

    db.expense.aggregate({
      where: {
        ...expenseWhere,
        status: 'APPROVED',
      },

      _sum: {
        amountInclTax: true,
      },
    }),
  ])

  const metrics: AccountingChecklistMetrics = {
    periodEnded:
      isBusinessPeriodEnded(
        period.endDate,
        now,
        timeZone,
      ),

    priorUnclosedPeriods,

    draftInvoices,

    draftExpenses,
    submittedExpenses,
    rejectedExpenses,

    expensesWithoutAttachments,

    outstandingInvoices,

    outstandingInvoicesAmount:
      Math.max(
        0,
        Number(
          outstandingInvoicesAggregate
            ._sum
            .total
          ?? 0,
        )
        - Number(
          outstandingPaymentsAggregate
            ._sum
            .amount
          ?? 0,
        ),
      ).toFixed(2),

    approvedUnpaidExpenses,

    approvedUnpaidExpensesAmount:
      (
        approvedUnpaidExpensesAggregate
          ._sum
          .amountInclTax
        ?? 0
      ).toString(),
  }

  return {
    period: {
      id: period.id,
      label: period.label,
      status: period.status,
      startDate: period.startDate,
      endDate: period.endDate,
      lockVersion: period.lockVersion,
      fiscalYear: period.fiscalYear,
    },

    metrics,

    ...evaluateAccountingChecklist(
      metrics,
    ),

    computedAt: now,
  }
}
