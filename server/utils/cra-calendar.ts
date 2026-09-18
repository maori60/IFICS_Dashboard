import holidays from '../data/jours-feries-metropole.json'
import { badRequest, requiredString } from './validation'

const holidayDates = new Set(Object.keys(holidays))
const coveredYears = new Set(
  Object.keys(holidays).map(date => Number(date.slice(0, 4))),
)
export const CRA_HOURS_PER_DAY = 7

export function validateCraDate(
  value: unknown,
  period: { year: number; month: number },
): Date {
  const text = requiredString(value, 'Date', { min: 10, max: 10 })

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    badRequest('La date doit respecter le format AAAA-MM-JJ.')
  }

  const date = new Date(`${text}T00:00:00.000Z`)

  if (
    Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== text
  ) {
    badRequest('Cette date est invalide.')
  }

  if (
    date.getUTCFullYear() !== period.year
    || date.getUTCMonth() + 1 !== period.month
  ) {
    badRequest('Cette journée ne correspond pas au mois du CRA.')
  }

  const weekday = date.getUTCDay()

  if (weekday === 0 || weekday === 6) {
    badRequest('Les samedis et dimanches ne peuvent pas être déclarés.')
  }

  if (!coveredYears.has(period.year)) {
    badRequest(
      'Le calendrier des jours fériés doit être actualisé pour cette année.',
    )
  }

  if (holidayDates.has(text)) {
    badRequest('Les jours fériés ne peuvent pas être déclarés.')
  }

  return date
}
