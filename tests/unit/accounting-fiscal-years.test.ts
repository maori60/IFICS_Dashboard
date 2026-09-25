import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  buildAccountingPeriods,
  defaultFiscalYearLabel,
  fiscalYearEndDate,
  parseAccountingDateOnly,
  requireFiscalYearStartDate,
} from '../../server/utils/accounting-fiscal-years'

describe(
  'Exercices et périodes comptables',
  () => {
    it(
      'analyse une date comptable sans ambiguïté de fuseau',
      () => {
        const date
          = parseAccountingDateOnly(
            '2026-09-01',
            'Date',
          )

        expect(
          date.toISOString(),
        ).toBe(
          '2026-09-01T00:00:00.000Z',
        )
      },
    )

    it(
      'refuse une date civile invalide',
      () => {
        expect(() =>
          parseAccountingDateOnly(
            '2026-02-31',
            'Date',
          ),
        ).toThrow()
      },
    )

    it(
      'refuse un exercice qui ne commence pas le premier du mois',
      () => {
        expect(() =>
          requireFiscalYearStartDate(
            '2026-09-15',
          ),
        ).toThrow()
      },
    )

    it(
      'génère douze périodes pour un exercice civil',
      () => {
        const start
          = requireFiscalYearStartDate(
            '2026-01-01',
          )

        const periods
          = buildAccountingPeriods(start)

        expect(periods).toHaveLength(12)

        expect(periods[0]).toMatchObject({
          number: 1,
          label: 'Janvier 2026',
        })

        expect(
          periods[0]!.startDate.toISOString(),
        ).toBe(
          '2026-01-01T00:00:00.000Z',
        )

        expect(
          periods[11]!.endDate.toISOString(),
        ).toBe(
          '2026-12-31T23:59:59.999Z',
        )

        expect(
          defaultFiscalYearLabel(start),
        ).toBe(
          'Exercice 2026',
        )
      },
    )

    it(
      'génère correctement un exercice décalé',
      () => {
        const start
          = requireFiscalYearStartDate(
            '2026-04-01',
          )

        const periods
          = buildAccountingPeriods(start)

        expect(periods).toHaveLength(12)

        expect(periods[0]).toMatchObject({
          number: 1,
          label: 'Avril 2026',
        })

        expect(periods[11]).toMatchObject({
          number: 12,
          label: 'Mars 2027',
        })

        expect(
          fiscalYearEndDate(start)
            .toISOString(),
        ).toBe(
          '2027-03-31T23:59:59.999Z',
        )

        expect(
          defaultFiscalYearLabel(start),
        ).toBe(
          'Exercice 2026–2027',
        )
      },
    )

    it(
      'gère correctement février d’une année bissextile',
      () => {
        const start
          = requireFiscalYearStartDate(
            '2024-01-01',
          )

        const periods
          = buildAccountingPeriods(start)

        expect(
          periods[1]!.endDate.toISOString(),
        ).toBe(
          '2024-02-29T23:59:59.999Z',
        )
      },
    )
  },
)
