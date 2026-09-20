import holidays from '../data/jours-feries-metropole.json'
import { badRequest, requiredString } from './validation'

const holidayDates = new Set(Object.keys(holidays))
const coveredYears = new Set(
  Object.keys(holidays).map(date => Number(date.slice(0, 4))),
)

export const CRA_HOURS_PER_DAY = 7
export const CRA_EARLY_CLOSE_DAYS = 7

type CraPeriod = {
  year: number
  month: number
}

type CraDateValidationOptions = {
  allowFuture?: boolean
  now?: Date
}

export type CraPeriodPolicy = {
  today: string
  periodEnd: string
  earlyClosureStart: string
  futureDaysAllowed: boolean
  submissionAllowed: boolean
}

function isoUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parisIsoDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const value = (type: 'year' | 'month' | 'day') =>
    parts.find(part => part.type === type)?.value

  const year = value('year')
  const month = value('month')
  const day = value('day')

  if (!year || !month || !day) {
    throw new Error(
      'Impossible de déterminer la date courante à Paris.',
    )
  }

  return `${year}-${month}-${day}`
}

export function craPeriodPolicy(
  period: CraPeriod,
  now = new Date(),
): CraPeriodPolicy {
  const today = parisIsoDate(now)

  const end = new Date(Date.UTC(
    period.year,
    period.month,
    0,
  ))

  const earlyClosureStartDate = new Date(end)
  earlyClosureStartDate.setUTCDate(
    earlyClosureStartDate.getUTCDate()
    - CRA_EARLY_CLOSE_DAYS,
  )

  const periodEnd = isoUtcDate(end)
  const earlyClosureStart = isoUtcDate(
    earlyClosureStartDate,
  )

  return {
    today,
    periodEnd,
    earlyClosureStart,

    // Les jours futurs ne sont autorisés que pendant
    // la fenêtre de clôture anticipée du mois courant.
    futureDaysAllowed:
      today >= earlyClosureStart
      && today <= periodEnd,

    // Un mois passé reste naturellement clôturable.
    submissionAllowed:
      today >= earlyClosureStart,
  }
}

export function validateCraSubmissionWindow(
  period: CraPeriod,
  now = new Date(),
): CraPeriodPolicy {
  const policy = craPeriodPolicy(period, now)

  if (!policy.submissionAllowed) {
    badRequest(
      `Le CRA mensuel peut être transmis à partir de ${CRA_EARLY_CLOSE_DAYS} jours avant la fin du mois.`,
    )
  }

  return policy
}

export function validateCraDate(
  value: unknown,
  period: CraPeriod,
  options: CraDateValidationOptions = {},
): Date {
  const text = requiredString(value, 'Date', {
    min: 10,
    max: 10,
  })

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    badRequest(
      'La date doit respecter le format AAAA-MM-JJ.',
    )
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
    badRequest(
      'Cette journée ne correspond pas au mois du CRA.',
    )
  }

  const weekday = date.getUTCDay()

  if (weekday === 0 || weekday === 6) {
    badRequest(
      'Les samedis et dimanches ne peuvent pas être déclarés.',
    )
  }

  if (!coveredYears.has(period.year)) {
    badRequest(
      'Le calendrier des jours fériés doit être actualisé pour cette année.',
    )
  }

  if (holidayDates.has(text)) {
    badRequest(
      'Les jours fériés ne peuvent pas être déclarés.',
    )
  }

  if (
    !options.allowFuture
    && text > craPeriodPolicy(
      period,
      options.now,
    ).today
  ) {
    const policy = craPeriodPolicy(
      period,
      options.now,
    )

    if (!policy.futureDaysAllowed) {
      badRequest(
        `Les journées futures du CRA sont autorisées uniquement à partir de ${CRA_EARLY_CLOSE_DAYS} jours avant la fin du mois.`,
      )
    }
  }

  return date
}
