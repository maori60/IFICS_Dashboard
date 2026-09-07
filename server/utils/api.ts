import { createError, getRequestHeader, type H3Event } from 'h3'

export type ApiSuccess<T> = {
  ok: true
  data: T
}

export function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data }
}

export function httpError(
  statusCode: number,
  statusMessage: string,
  code: string,
  details?: unknown,
): never {
  throw createError({
    statusCode,
    statusMessage,
    data: {
      code,
      ...(details === undefined ? {} : { details }),
    },
  })
}

export function requireRouterId(value: string | undefined, label = 'Identifiant'): string {
  const id = value?.trim()

  if (!id) {
    httpError(400, `${label} manquant.`, 'MISSING_ID')
  }

  return id
}

export function prismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null
  }

  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export function requestUserAgent(event: H3Event): string | null {
  return getRequestHeader(event, 'user-agent')?.slice(0, 500) ?? null
}

export function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') {
      return item.toString()
    }

    if (item && typeof item === 'object' && typeof item.toJSON === 'function') {
      return item.toJSON()
    }

    return item
  })) as T
}

export function publicErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const statusMessage = (error as { statusMessage?: unknown }).statusMessage
    if (typeof statusMessage === 'string' && statusMessage) {
      return statusMessage
    }
  }

  return fallback
}
