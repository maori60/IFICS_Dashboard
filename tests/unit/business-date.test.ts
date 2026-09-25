import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  businessDateAsUtc,
  businessDateParts,
  businessMonthRange,
  isBusinessPeriodEnded,
  resolveBusinessTimeZone,
} from '../../server/utils/business-date'

describe(
  'Date métier selon le fuseau de l’association',
  () => {
    it(
      'reste au 30 septembre avant minuit à Paris',
      () => {
        const instant
          = new Date(
            '2026-09-30T21:59:00.000Z',
          )

        expect(
          businessDateParts(
            instant,
            'Europe/Paris',
          ),
        ).toEqual({
          year: 2026,
          month: 9,
          day: 30,
        })
      },
    )

    it(
      'passe au 1er octobre dès minuit à Paris',
      () => {
        const instant
          = new Date(
            '2026-09-30T22:01:00.000Z',
          )

        expect(
          businessDateAsUtc(
            instant,
            'Europe/Paris',
          ).toISOString(),
        ).toBe(
          '2026-10-01T00:00:00.000Z',
        )
      },
    )

    it(
      'gère le décalage heure été',
      () => {
        const instant
          = new Date(
            '2026-06-30T22:30:00.000Z',
          )

        expect(
          businessDateParts(
            instant,
            'Europe/Paris',
          ),
        ).toEqual({
          year: 2026,
          month: 7,
          day: 1,
        })
      },
    )

    it(
      'gère le décalage heure hiver',
      () => {
        const instant
          = new Date(
            '2026-11-30T23:30:00.000Z',
          )

        expect(
          businessDateParts(
            instant,
            'Europe/Paris',
          ),
        ).toEqual({
          year: 2026,
          month: 12,
          day: 1,
        })
      },
    )

    it(
      'sélectionne octobre même si UTC est encore en septembre',
      () => {
        const range
          = businessMonthRange(
            new Date(
              '2026-09-30T22:01:00.000Z',
            ),
            'Europe/Paris',
          )

        expect(
          range.year,
        ).toBe(2026)

        expect(
          range.month,
        ).toBe(10)

        expect(
          range.start.toISOString(),
        ).toBe(
          '2026-10-01T00:00:00.000Z',
        )

        expect(
          range.end.toISOString(),
        ).toBe(
          '2026-11-01T00:00:00.000Z',
        )
      },
    )

    it(
      'termine septembre dès le 1er octobre civil à Paris',
      () => {
        const end
          = new Date(
            '2026-09-30T23:59:59.999Z',
          )

        expect(
          isBusinessPeriodEnded(
            end,
            new Date(
              '2026-09-30T21:59:00.000Z',
            ),
            'Europe/Paris',
          ),
        ).toBe(false)

        expect(
          isBusinessPeriodEnded(
            end,
            new Date(
              '2026-09-30T22:01:00.000Z',
            ),
            'Europe/Paris',
          ),
        ).toBe(true)
      },
    )

    it(
      'retombe sur Europe/Paris si un fuseau stocké est invalide',
      () => {
        expect(
          resolveBusinessTimeZone(
            'Fuseau/Invalide',
          ),
        ).toBe(
          'Europe/Paris',
        )
      },
    )
  },
)
