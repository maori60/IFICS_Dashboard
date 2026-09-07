import { randomUUID } from 'node:crypto'
import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  const requestId = randomUUID()
  event.context.requestId = requestId

  setResponseHeader(event, 'X-Request-Id', requestId)
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  setResponseHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')
  setResponseHeader(event, 'Cross-Origin-Resource-Policy', 'same-origin')
  setResponseHeader(
    event,
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' blob:",
    ].join('; '),
  )

  if (process.env.NODE_ENV === 'production') {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})
