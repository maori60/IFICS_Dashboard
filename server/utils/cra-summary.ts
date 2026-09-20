export const CRA_DEFAULT_DAY_MINUTES = 420
export const CRA_MAX_DAY_MINUTES = 720

export const CRA_WRITABLE_DAY_TYPES = [
  'WORK',
  'PAID_LEAVE',
  'RTT',
  'SICK_LEAVE',
  'AUTHORIZED_ABSENCE',
  'UNJUSTIFIED_ABSENCE',
  'TRAINING',
  'OTHER',
] as const

export type CraWritableDayType = typeof CRA_WRITABLE_DAY_TYPES[number]

export type CraSummaryDay = {
  dayType: string
  durationMinutes: number
}

export function isCraWritableDayType(
  value: unknown,
): value is CraWritableDayType {
  return typeof value === 'string'
    && CRA_WRITABLE_DAY_TYPES.includes(value as CraWritableDayType)
}

export function summarizeCraDays(days: CraSummaryDay[]) {
  let workedDays = 0
  let workedMinutes = 0

  let trainingDays = 0
  let trainingMinutes = 0

  let paidLeaveDays = 0
  let rttDays = 0
  let sickLeaveDays = 0
  let authorizedAbsenceDays = 0
  let unjustifiedAbsenceDays = 0
  let otherAbsenceDays = 0
  let publicHolidayDays = 0

  for (const day of days) {
    switch (day.dayType) {
      case 'WORK':
        workedDays += 1
        workedMinutes += day.durationMinutes
        break

      case 'TRAINING':
        trainingDays += 1
        trainingMinutes += day.durationMinutes
        break

      case 'PAID_LEAVE':
        paidLeaveDays += 1
        break

      case 'RTT':
        rttDays += 1
        break

      case 'SICK_LEAVE':
        sickLeaveDays += 1
        break

      case 'AUTHORIZED_ABSENCE':
        authorizedAbsenceDays += 1
        break

      case 'UNJUSTIFIED_ABSENCE':
        unjustifiedAbsenceDays += 1
        break

      case 'PUBLIC_HOLIDAY':
        publicHolidayDays += 1
        break

      case 'OTHER':
        otherAbsenceDays += 1
        break
    }
  }

  const absenceDays
    = paidLeaveDays
      + rttDays
      + sickLeaveDays
      + authorizedAbsenceDays
      + unjustifiedAbsenceDays
      + otherAbsenceDays

  return {
    declaredDays: days.length,

    // Compatibilité avec les CRA existants :
    // totalDays / totalHours = activité réellement travaillée.
    totalDays: workedDays,
    totalMinutes: workedMinutes,
    totalHours: workedMinutes / 60,

    workedDays,
    workedMinutes,

    trainingDays,
    trainingMinutes,
    trainingHours: trainingMinutes / 60,

    absenceDays,
    paidLeaveDays,
    rttDays,
    sickLeaveDays,
    authorizedAbsenceDays,
    unjustifiedAbsenceDays,
    otherAbsenceDays,
    publicHolidayDays,
  }
}
