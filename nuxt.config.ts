// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      titleTemplate: '%s · IFICS',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#123b2a' },
        { name: 'description', content: 'IFICS — association engagée pour l’éducation, le sport, la culture, le numérique, l’insertion et l’innovation.' },
      ],
    },
  },
  devtools: {
    enabled: process.env.NODE_ENV !== 'production',
  },
})
