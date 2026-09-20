import { describe, expect, it } from 'vitest'
import {
  craPeriodPolicy,
  validateCraDate,
} from '../../server/utils/cra-calendar'

describe('Calendrier CRA', () => {
  it('accepte un jour ouvré en conservant sa date', () => {
    const result = validateCraDate(
      '2026-09-18',
      { year: 2026, month: 9 },
    )

    expect(result.toISOString()).toBe(
      '2026-09-18T00:00:00.000Z',
    )
  })

  it.each([
    '2026-09-19',
    '2026-09-20',
  ])('refuse le week-end : %s', (date) => {
    expect(() =>
      validateCraDate(
        date,
        { year: 2026, month: 9 },
      ),
    ).toThrow(
      'Les samedis et dimanches ne peuvent pas être déclarés.',
    )
  })

  it.each([
    ['2026-07-14', 7],
    ['2026-04-06', 4],
    ['2026-05-14', 5],
    ['2026-05-25', 5],
  ])(
    'refuse le jour férié : %s',
    (date, month) => {
      expect(() =>
        validateCraDate(
          date,
          { year: 2026, month },
        ),
      ).toThrow(
        'Les jours fériés ne peuvent pas être déclarés.',
      )
    },
  )

  it('refuse une date impossible', () => {
    expect(() =>
      validateCraDate(
        '2026-02-30',
        { year: 2026, month: 2 },
      ),
    ).toThrow(
      'Cette date est invalide.',
    )
  })

  it('refuse un format ambigu', () => {
    expect(() =>
      validateCraDate(
        '18/09/2026',
        { year: 2026, month: 9 },
      ),
    ).toThrow(
      'La date doit respecter le format AAAA-MM-JJ.',
    )
  })

  it('refuse une journée appartenant à un autre mois', () => {
    expect(() =>
      validateCraDate(
        '2026-10-01',
        { year: 2026, month: 9 },
      ),
    ).toThrow(
      'Cette journée ne correspond pas au mois du CRA.',
    )
  })

  it('accepte le 29 février lors d’une année bissextile', () => {
    const result = validateCraDate(
      '2028-02-29',
      { year: 2028, month: 2 },
    )

    expect(result.toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    )
  })

  it('autorise une journée future ouvrée du même mois', () => {
    expect(() =>
      validateCraDate(
        '2026-09-30',
        { year: 2026, month: 9 },
      ),
    ).not.toThrow()
  })

  it('calcule le dernier jour de la période du CRA', () => {
    expect(
      craPeriodPolicy({
        year: 2026,
        month: 9,
      }),
    ).toEqual({
      periodEnd: '2026-09-30',
    })
  })

  it('calcule correctement la fin d’un février bissextile', () => {
    expect(
      craPeriodPolicy({
        year: 2028,
        month: 2,
      }),
    ).toEqual({
      periodEnd: '2028-02-29',
    })
  })

  it('refuse une année absente du calendrier', () => {
    expect(() =>
      validateCraDate(
        '2100-01-04',
        { year: 2100, month: 1 },
      ),
    ).toThrow(
      'Le calendrier des jours fériés doit être actualisé pour cette année.',
    )
  })
})
