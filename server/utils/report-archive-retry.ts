type RetryOptions = {
  maxAttempts?: number
  delayMs?: number
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_DELAY_MS = 40

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isReportArchiveRetryableError(
  error: unknown,
): boolean {
  if (!isRecord(error)) {
    return false
  }

  // Une erreur HTTP est une décision applicative définitive.
  // Elle ne doit jamais déclencher une nouvelle transaction.
  if (
    typeof error.statusCode === 'number'
    && Number.isInteger(error.statusCode)
    && error.statusCode >= 400
    && error.statusCode <= 599
  ) {
    return false
  }

  if (error.code === 'P2034') {
    return true
  }

  if (
    error.name === 'DriverAdapterError'
    && isRecord(error.cause)
    && error.cause.kind === 'TransactionWriteConflict'
  ) {
    return true
  }

  return false
}

export async function retryReportArchiveTransaction<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS

  if (
    !Number.isSafeInteger(maxAttempts)
    || maxAttempts < 1
    || maxAttempts > 10
  ) {
    throw new RangeError('Nombre de tentatives invalide.')
  }

  if (
    !Number.isFinite(delayMs)
    || delayMs < 0
    || delayMs > 5_000
  ) {
    throw new RangeError('Délai de reprise invalide.')
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    }
    catch (error) {
      if (
        !isReportArchiveRetryableError(error)
        || attempt === maxAttempts
      ) {
        throw error
      }

      if (delayMs > 0) {
        const waitMs = Math.min(
          5_000,
          delayMs * attempt + Math.floor(Math.random() * delayMs),
        )

        await new Promise<void>(resolve => {
          setTimeout(resolve, waitMs)
        })
      }
    }
  }

  throw new Error('Reprise transactionnelle impossible.')
}
