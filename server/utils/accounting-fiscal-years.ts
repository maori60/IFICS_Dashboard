import { badRequest } from './validation'

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const

export type AccountingPeriodSeed = {
  number: number
  label: string
  startDate: Date
  endDate: Date
}

export function parseAccountingDateOnly(
  value: unknown,
  label: string,
): Date {
  if (typeof value !== 'string') {
    badRequest(
      `${label} doit être une date au format AAAA-MM-JJ.`,
    )
  }

  const text = value.trim()

  const match
    = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)

  if (!match) {
    badRequest(
      `${label} doit être une date au format AAAA-MM-JJ.`,
    )
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0,
    ),
  )

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    badRequest(`${label} est invalide.`)
  }

  return date
}

export function requireFiscalYearStartDate(
  value: unknown,
): Date {
  const date = parseAccountingDateOnly(
    value,
    'Date de début de l’exercice',
  )

  if (date.getUTCDate() !== 1) {
    badRequest(
      'Un exercice doit commencer le premier jour d’un mois.',
    )
  }

  return date
}

export function buildAccountingPeriods(
  fiscalYearStart: Date,
): AccountingPeriodSeed[] {
  const periods: AccountingPeriodSeed[] = []

  const baseYear
    = fiscalYearStart.getUTCFullYear()

  const baseMonth
    = fiscalYearStart.getUTCMonth()

  for (let offset = 0; offset < 12; offset += 1) {
    const startDate = new Date(
      Date.UTC(
        baseYear,
        baseMonth + offset,
        1,
        0,
        0,
        0,
        0,
      ),
    )

    const endDate = new Date(
      Date.UTC(
        baseYear,
        baseMonth + offset + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    )

    periods.push({
      number: offset + 1,

      label:
        `${MONTH_NAMES[startDate.getUTCMonth()]} `
        + `${startDate.getUTCFullYear()}`,

      startDate,
      endDate,
    })
  }

  return periods
}

export function fiscalYearEndDate(
  fiscalYearStart: Date,
): Date {
  const periods
    = buildAccountingPeriods(fiscalYearStart)

  return periods[periods.length - 1]!.endDate
}

export function defaultFiscalYearLabel(
  fiscalYearStart: Date,
): string {
  const endDate
    = fiscalYearEndDate(fiscalYearStart)

  const startYear
    = fiscalYearStart.getUTCFullYear()

  const endYear
    = endDate.getUTCFullYear()

  if (
    fiscalYearStart.getUTCMonth() === 0
    && startYear === endYear
  ) {
    return `Exercice ${startYear}`
  }

  return `Exercice ${startYear}–${endYear}`
}
