// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxt/eslint'],
  devtools: {
    enabled: process.env.NODE_ENV !== 'production',
  },
})
