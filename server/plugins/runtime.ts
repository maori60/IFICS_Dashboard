import { defineNitroPlugin } from 'nitropack/runtime'
import { getResponseStatus, getRequestURL } from 'h3'
import { validateProductionSecrets } from '../utils/security'

export default defineNitroPlugin((nitroApp) => {
  validateProductionSecrets()

  const startedAt = new WeakMap<object, number>()

  nitroApp.hooks.hook('request', (event) => {
    startedAt.set(event, Date.now())
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const start = startedAt.get(event) ?? Date.now()
    const url = getRequestURL(event)

    console.log(JSON.stringify({
      level: 'info',
      event: 'http_request',
      requestId: event.context.requestId ?? null,
      method: event.method,
      path: url.pathname,
      status: getResponseStatus(event),
      durationMs: Date.now() - start,
    }))
  })

  nitroApp.hooks.hook('error', (error, context) => {
    console.error(JSON.stringify({
      level: 'error',
      event: 'nitro_error',
      requestId: context.event?.context.requestId ?? null,
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    }))
  })
})
