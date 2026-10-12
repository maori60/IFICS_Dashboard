import { badRequest } from './validation'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateReportTimes(
  startValue: unknown,
  endValue: unknown,
): { startTime: string | null; endTime: string | null } {
  function parse(value: unknown, label: string): string | null {
    if (value === undefined || value === null || value === '') {
      return null
    }

    if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
      badRequest(`${label} doit respecter le format HH:mm.`, 'REPORT_TIME_INVALID')
    }

    return value
  }

  const startTime = parse(startValue, 'Heure de début')
  const endTime = parse(endValue, 'Heure de fin')

  if (startTime && endTime && endTime <= startTime) {
    badRequest(
      "L'heure de fin doit être postérieure à l'heure de début.",
      'REPORT_TIME_RANGE_INVALID',
    )
  }

  return { startTime, endTime }
}
