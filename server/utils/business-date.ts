export const DEFAULT_BUSINESS_TIMEZONE
  = 'Europe/Paris'

export type BusinessDateParts = {
  year: number
  month: number
  day: number
}

export type BusinessMonthRange = {
  year: number
  month: number
  start: Date
  end: Date
}

export function resolveBusinessTimeZone(
  timeZone: string | null | undefined,
): string {
  const candidate
    = timeZone?.trim()
      || DEFAULT_BUSINESS_TIMEZONE

  try {
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: candidate,
      },
    ).format(
      new Date(0),
    )

    return candidate
  }
  catch {
    return DEFAULT_BUSINESS_TIMEZONE
  }
}

export function businessDateParts(
  instant: Date,
  timeZone?: string | null,
): BusinessDateParts {
  if (
    Number.isNaN(
      instant.getTime(),
    )
  ) {
    throw new TypeError(
      'Instant métier invalide.',
    )
  }

  const resolvedTimeZone
    = resolveBusinessTimeZone(
      timeZone,
    )

  const formattedParts
    = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          resolvedTimeZone,

        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
    ).formatToParts(
      instant,
    )

  const value = (
    type: Intl.DateTimeFormatPartTypes,
  ): number => {
    const part
      = formattedParts.find(
        item =>
          item.type === type,
      )

    const number
      = Number(part?.value)

    if (
      !Number.isInteger(number)
    ) {
      throw new TypeError(
        'Date métier impossible à déterminer.',
      )
    }

    return number
  }

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  }
}

export function businessDateAsUtc(
  instant: Date,
  timeZone?: string | null,
): Date {
  const {
    year,
    month,
    day,
  } = businessDateParts(
    instant,
    timeZone,
  )

  /*
   * Cette date UTC est volontairement
   * une représentation logique de la
   * date civile métier.
   *
   * Exemple :
   * 01/10 à 00:01 Europe/Paris
   * devient 01/10 à 00:00 UTC logique,
   * même si l'instant réel est encore
   * le 30/09 en UTC.
   */
  return new Date(
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
}

export function businessMonthRange(
  instant: Date,
  timeZone?: string | null,
): BusinessMonthRange {
  const {
    year,
    month,
  } = businessDateParts(
    instant,
    timeZone,
  )

  return {
    year,
    month,

    start: new Date(
      Date.UTC(
        year,
        month - 1,
        1,
      ),
    ),

    end: new Date(
      Date.UTC(
        year,
        month,
        1,
      ),
    ),
  }
}

export function previousBusinessMonthRange(
  instant: Date,
  timeZone?: string | null,
): BusinessMonthRange {
  const {
    year,
    month,
  } = businessDateParts(
    instant,
    timeZone,
  )

  const start
    = new Date(
      Date.UTC(
        year,
        month - 2,
        1,
      ),
    )

  const end
    = new Date(
      Date.UTC(
        year,
        month - 1,
        1,
      ),
    )

  return {
    year:
      start.getUTCFullYear(),

    month:
      start.getUTCMonth() + 1,

    start,
    end,
  }
}

export function isBusinessPeriodEnded(
  periodEnd: Date,
  instant: Date,
  timeZone?: string | null,
): boolean {
  return businessDateAsUtc(
    instant,
    timeZone,
  ) > periodEnd
}

export function isBusinessDateInPeriod(
  periodStart: Date,
  periodEnd: Date,
  instant: Date,
  timeZone?: string | null,
): boolean {
  const businessDate
    = businessDateAsUtc(
      instant,
      timeZone,
    )

  return (
    businessDate >= periodStart
    && businessDate <= periodEnd
  )
}
