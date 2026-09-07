import {
  createError,
  defineEventHandler,
  getMethod,
  getRequestHeader,
  getRequestURL,
} from 'h3'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  const method = getMethod(event).toUpperCase()

  if (SAFE_METHODS.has(method)) {
    return
  }

  const origin = getRequestHeader(event, 'origin')

  // Non-browser clients may legitimately omit Origin. Browser requests carrying
  // cookies do send it for unsafe cross-origin methods, so this blocks CSRF while
  // preserving CLI/API administration on the same authenticated endpoint.
  if (!origin) {
    return
  }

  const requestOrigin = getRequestURL(event).origin
  const configuredOrigin = process.env.APP_BASE_URL
    ? new URL(process.env.APP_BASE_URL).origin
    : requestOrigin

  if (origin !== configuredOrigin && origin !== requestOrigin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Origine de requête refusée.',
      data: { code: 'ORIGIN_FORBIDDEN' },
    })
  }
})
