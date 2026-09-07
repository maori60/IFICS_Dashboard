import type { ApiSuccess, SessionPayload } from '~/types/api'

export default defineNuxtRouteMiddleware(async () => {
  try {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const response = await $fetch<ApiSuccess<SessionPayload>>('/api/auth/me', { headers })

    if (response.data.mfa.setupRequired || (response.data.mfa.enabled && !response.data.mfa.verified)) {
      return navigateTo('/mfa')
    }
  }
  catch {
    return navigateTo('/login')
  }
})
