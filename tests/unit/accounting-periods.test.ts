import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  assertAccountingDateWritable,
  assertExpenseAccountingPeriodWritable,
} from '../../server/utils/accounting-periods'

const {
  periodFindFirst,
  expenseFindFirst,
} = vi.hoisted(() => ({
  periodFindFirst: vi.fn(),
  expenseFindFirst: vi.fn(),
}))

vi.mock('../../server/utils/prisma', () => ({
  prisma: {
    accountingPeriod: {
      findFirst: periodFindFirst,
    },

    expense: {
      findFirst: expenseFindFirst,
    },
  },
}))

function period(
  status: string,
  fiscalYearStatus = 'OPEN',
) {
  return {
    id: 'period-test',
    label: 'Septembre 2026',
    status,
    startDate:
      new Date('2026-09-01T00:00:00.000Z'),
    endDate:
      new Date('2026-09-30T23:59:59.999Z'),

    fiscalYear: {
      id: 'year-test',
      label: 'Exercice 2026',
      status: fiscalYearStatus,
    },
  }
}

describe(
  'Verrouillage des périodes comptables',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it(
      'autorise une date sans période configurée',
      async () => {
        periodFindFirst.mockResolvedValue(null)

        await expect(
          assertAccountingDateWritable(
            'association-test',
            new Date(
              '2026-09-15T12:00:00.000Z',
            ),
          ),
        ).resolves.toBeNull()
      },
    )

    it.each([
      'OPEN',
      'REVIEW',
    ])(
      'autorise une période %s',
      async (status) => {
        periodFindFirst.mockResolvedValue(
          period(status),
        )

        await expect(
          assertAccountingDateWritable(
            'association-test',
            new Date(
              '2026-09-15T12:00:00.000Z',
            ),
          ),
        ).resolves.toMatchObject({
          status,
        })
      },
    )

    it.each([
      'PRE_CLOSED',
      'CLOSED',
    ])(
      'refuse une période %s',
      async (status) => {
        periodFindFirst.mockResolvedValue(
          period(status),
        )

        await expect(
          assertAccountingDateWritable(
            'association-test',
            new Date(
              '2026-09-15T12:00:00.000Z',
            ),
          ),
        ).rejects.toMatchObject({
          statusCode: 409,

          data: expect.objectContaining({
            code: 'ACCOUNTING_PERIOD_LOCKED',
          }),
        })
      },
    )

    it(
      'refuse une période ouverte appartenant à un exercice clôturé',
      async () => {
        periodFindFirst.mockResolvedValue(
          period('OPEN', 'CLOSED'),
        )

        await expect(
          assertAccountingDateWritable(
            'association-test',
            new Date(
              '2026-09-15T12:00:00.000Z',
            ),
          ),
        ).rejects.toMatchObject({
          statusCode: 409,

          data: expect.objectContaining({
            code: 'ACCOUNTING_PERIOD_LOCKED',
          }),
        })
      },
    )

    it(
      'contrôle la période d’origine d’une dépense',
      async () => {
        expenseFindFirst.mockResolvedValue({
          expenseDate:
            new Date(
              '2026-09-08T00:00:00.000Z',
            ),
        })

        periodFindFirst.mockResolvedValue(
          period('CLOSED'),
        )

        await expect(
          assertExpenseAccountingPeriodWritable(
            'association-test',
            'expense-test',
          ),
        ).rejects.toMatchObject({
          statusCode: 409,

          data: expect.objectContaining({
            code: 'ACCOUNTING_PERIOD_LOCKED',
          }),
        })
      },
    )
  },
)
