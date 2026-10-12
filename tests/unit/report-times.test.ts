import { describe, expect, it } from 'vitest'
import { validateReportTimes } from '../../server/utils/report-times'

describe('Validation des horaires des bilans IFICS', () => {
  it('accepte les horaires facultatifs', () => {
    expect(validateReportTimes(undefined, undefined)).toEqual({
      startTime: null,
      endTime: null,
    })

    expect(validateReportTimes('09:30', '')).toEqual({
      startTime: '09:30',
      endTime: null,
    })

    expect(validateReportTimes('', '12:00')).toEqual({
      startTime: null,
      endTime: '12:00',
    })
  })

  it('accepte une plage horaire valide', () => {
    expect(validateReportTimes('09:30', '12:00')).toEqual({
      startTime: '09:30',
      endTime: '12:00',
    })
  })

  it.each([
    ['25:80', '12:00'],
    ['9:30', '12:00'],
    ['09:60', '12:00'],
    ['abc', '12:00'],
  ])('refuse un format horaire invalide (%s)', (start, end) => {
    expect(() => validateReportTimes(start, end)).toThrow()
  })

  it.each([
    ['14:00', '12:00'],
    ['09:30', '09:30'],
  ])('refuse une plage incohérente (%s - %s)', (start, end) => {
    expect(() => validateReportTimes(start, end)).toThrow()
  })
})
