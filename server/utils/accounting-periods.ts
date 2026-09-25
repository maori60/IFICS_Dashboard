import { httpError } from './api'
import { prisma } from './prisma'

const LOCKED_PERIOD_STATUSES = new Set([
  'PRE_CLOSED',
  'CLOSED',
])

type AccountingPeriodInfo = {
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

export async function findAccountingPeriodForDate(
  associationId: string,
  date: Date,
): Promise<AccountingPeriodInfo | null> {
  return prisma.accountingPeriod.findFirst({
    where: {
      associationId,
      startDate: {
        lte: date,
      },
      endDate: {
        gte: date,
      },
    },

    orderBy: {
      startDate: 'desc',
    },

    select: {
      id: true,
      label: true,
      status: true,
      startDate: true,
      endDate: true,

      fiscalYear: {
        select: {
          id: true,
          label: true,
          status: true,
        },
      },
    },
  })
}

export async function assertAccountingDateWritable(
  associationId: string,
  date: Date,
  resourceLabel = 'opération',
): Promise<AccountingPeriodInfo | null> {
  const period = await findAccountingPeriodForDate(
    associationId,
    date,
  )

  /*
   * Compatibilité progressive :
   * tant qu'aucun exercice/période n'a été créé pour cette date,
   * l'application continue de fonctionner comme avant.
   *
   * Une fois les périodes créées, leurs règles de verrouillage
   * deviennent effectives.
   */
  if (!period) {
    return null
  }

  const locked
    = LOCKED_PERIOD_STATUSES.has(period.status)
      || period.fiscalYear.status === 'CLOSED'

  if (locked) {
    httpError(
      409,
      `La période comptable « ${period.label} » est verrouillée. `
      + `La ${resourceLabel} ne peut plus modifier les données comptables de cette période.`,
      'ACCOUNTING_PERIOD_LOCKED',
    )
  }

  return period
}

export async function assertExpenseAccountingPeriodWritable(
  associationId: string,
  expenseId: string,
): Promise<AccountingPeriodInfo | null> {
  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      associationId,
      archivedAt: null,
    },

    select: {
      expenseDate: true,
    },
  })

  if (!expense) {
    httpError(
      404,
      'Dépense introuvable.',
      'EXPENSE_NOT_FOUND',
    )
  }

  return assertAccountingDateWritable(
    associationId,
    expense.expenseDate,
    'dépense',
  )
}
