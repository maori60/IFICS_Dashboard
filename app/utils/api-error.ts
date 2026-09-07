type ErrorShape = {
  data?: {
    statusMessage?: unknown
    message?: unknown
  }
  statusMessage?: unknown
  message?: unknown
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback
  const candidate = error as ErrorShape
  const values = [candidate.data?.statusMessage, candidate.data?.message, candidate.statusMessage, candidate.message]
  const message = values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)
  return message || fallback
}
