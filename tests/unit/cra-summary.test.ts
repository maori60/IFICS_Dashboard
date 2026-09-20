import { describe, expect, it } from 'vitest'
import {
  CRA_DEFAULT_DAY_MINUTES,
  CRA_MAX_DAY_MINUTES,
  isCraWritableDayType,
  summarizeCraDays,
} from '../../server/utils/cra-summary'

describe('Résumé métier des journées CRA', () => {
  it('conserve le comportement historique de 7 heures pour une journée travaillée', () => {
    const summary = summarizeCraDays([
      {
        dayType: 'WORK',
        durationMinutes: CRA_DEFAULT_DAY_MINUTES,
      },
    ])

    expect(summary).toMatchObject({
      declaredDays: 1,
      totalDays: 1,
      totalMinutes: 420,
      totalHours: 7,
      workedDays: 1,
      workedMinutes: 420,
      trainingDays: 0,
      absenceDays: 0,
    })
  })

  it('sépare travail, formation et absences', () => {
    const summary = summarizeCraDays([
      { dayType: 'WORK', durationMinutes: 420 },
      { dayType: 'TRAINING', durationMinutes: 210 },
      { dayType: 'PAID_LEAVE', durationMinutes: 420 },
      { dayType: 'RTT', durationMinutes: 420 },
      { dayType: 'SICK_LEAVE', durationMinutes: 420 },
      { dayType: 'AUTHORIZED_ABSENCE', durationMinutes: 420 },
      { dayType: 'OTHER', durationMinutes: 420 },
    ])

    expect(summary).toEqual({
      declaredDays: 7,

      totalDays: 1,
      totalMinutes: 420,
      totalHours: 7,

      workedDays: 1,
      workedMinutes: 420,

      trainingDays: 1,
      trainingMinutes: 210,
      trainingHours: 3.5,

      absenceDays: 5,
      paidLeaveDays: 1,
      rttDays: 1,
      sickLeaveDays: 1,
      authorizedAbsenceDays: 1,
      unjustifiedAbsenceDays: 0,
      otherAbsenceDays: 1,

      publicHolidayDays: 0,
    })
  })

  it('ne permet pas de saisir manuellement un jour férié', () => {
    expect(isCraWritableDayType('WORK')).toBe(true)
    expect(isCraWritableDayType('PAID_LEAVE')).toBe(true)
    expect(isCraWritableDayType('TRAINING')).toBe(true)

    expect(isCraWritableDayType('PUBLIC_HOLIDAY')).toBe(false)
    expect(isCraWritableDayType('INVALID')).toBe(false)
  })

  it('définit les limites métier de durée', () => {
    expect(CRA_DEFAULT_DAY_MINUTES).toBe(420)
    expect(CRA_MAX_DAY_MINUTES).toBe(720)
  })
})
