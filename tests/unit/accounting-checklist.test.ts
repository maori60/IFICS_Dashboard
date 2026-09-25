import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  evaluateAccountingChecklist,
  type AccountingChecklistMetrics,
} from '../../server/utils/accounting-checklist'

function metrics(
  overrides:
    Partial<AccountingChecklistMetrics> = {},
): AccountingChecklistMetrics {
  return {
    periodEnded: true,
    priorUnclosedPeriods: 0,

    draftInvoices: 0,

    draftExpenses: 0,
    submittedExpenses: 0,
    rejectedExpenses: 0,

    expensesWithoutAttachments: 0,

    outstandingInvoices: 0,
    outstandingInvoicesAmount: '0',

    approvedUnpaidExpenses: 0,
    approvedUnpaidExpensesAmount: '0',

    ...overrides,
  }
}

describe(
  'Checklist de clôture comptable',
  () => {
    it(
      'autorise la pré-clôture sans blocage',
      () => {
        const result
          = evaluateAccountingChecklist(
            metrics(),
          )

        expect(
          result.readyForPreClose,
        ).toBe(true)

        expect(
          result.blockerCount,
        ).toBe(0)
      },
    )

    it(
      'bloque une période encore en cours',
      () => {
        const result
          = evaluateAccountingChecklist(
            metrics({
              periodEnded: false,
            }),
          )

        expect(
          result.readyForPreClose,
        ).toBe(false)

        expect(
          result.items.find(
            item =>
              item.code
              === 'PERIOD_NOT_ENDED',
          )?.status,
        ).toBe('BLOCKER')
      },
    )

    it(
      'bloque si une période antérieure reste ouverte',
      () => {
        const result
          = evaluateAccountingChecklist(
            metrics({
              priorUnclosedPeriods: 2,
            }),
          )

        expect(
          result.readyForPreClose,
        ).toBe(false)

        expect(
          result.items.find(
            item =>
              item.code
              === 'PRIOR_PERIODS_NOT_CLOSED',
          )?.status,
        ).toBe('BLOCKER')
      },
    )

    it(
      'bloque les factures en brouillon',
      () => {
        const result
          = evaluateAccountingChecklist(
            metrics({
              draftInvoices: 2,
            }),
          )

        expect(
          result.readyForPreClose,
        ).toBe(false)

        expect(
          result.blockerCount,
        ).toBe(1)
      },
    )

    it(
      'bloque les dépenses non finalisées',
      () => {
        const result
          = evaluateAccountingChecklist(
            metrics({
              draftExpenses: 1,
              submittedExpenses: 2,
              rejectedExpenses: 1,
            }),
          )

        expect(
          result.readyForPreClose,
        ).toBe(false)

        expect(
          result.blockerCount,
        ).toBe(3)
      },
    )

    it(
      'ne bloque pas les factures restant à encaisser',
      () => {
        const result
          = evaluateAccountingChecklist(
            metrics({
              outstandingInvoices: 3,
              outstandingInvoicesAmount:
                '1250.50',
            }),
          )

        expect(
          result.readyForPreClose,
        ).toBe(true)

        expect(
          result.warningCount,
        ).toBe(1)
      },
    )

    it(
      'ne bloque pas les dépenses approuvées non réglées',
      () => {
        const result
          = evaluateAccountingChecklist(
            metrics({
              approvedUnpaidExpenses: 2,

              approvedUnpaidExpensesAmount:
                '320.00',
            }),
          )

        expect(
          result.readyForPreClose,
        ).toBe(true)

        expect(
          result.warningCount,
        ).toBe(1)
      },
    )

    it(
      'considère les justificatifs manquants comme avertissement',
      () => {
        const result
          = evaluateAccountingChecklist(
            metrics({
              expensesWithoutAttachments: 4,
            }),
          )

        expect(
          result.readyForPreClose,
        ).toBe(true)

        expect(
          result.items.find(
            item =>
              item.code
              === 'MISSING_EXPENSE_ATTACHMENTS',
          )?.status,
        ).toBe('WARNING')
      },
    )
  },
)
